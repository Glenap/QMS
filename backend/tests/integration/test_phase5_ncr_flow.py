"""
Integration tests for Phase 5 — the NCR lifecycle:

  An auto-raised NCR (from a failing cube test) is reviewed → a root cause is
  recorded → corrective actions are logged and worked → NDT/core retests are
  ordered and their results recorded → the RMC is notified → the NCR is closed
  (only once root cause + all actions are done) and can be reopened.

Plus RBAC (only the QE drives the lifecycle), the OPEN→UNDER_REVIEW→CLOSED
transition guards, and the list/detail roll-ups.
"""

from tests.helpers import API, bearer
from tests.integration.test_phase4_cube_flow import (
    _cast_sample,
    _qe_pour,
    _record_test,
)


async def _open_ncr(client, db_session):
    """(contractor_token, qe_token, pid, ncr_id) — a fresh OPEN NCR raised by a
    failing 28-day test (M30 required 30.0, observed 27.0 → FAIL)."""
    contractor_token, qe_token, pid, pour_id = await _qe_pour(client, db_session)
    sample_id = (await _cast_sample(client, qe_token, pid, pour_id)).json()["sample_id"]
    test = (
        await _record_test(client, db_session, qe_token, pid, sample_id, observed_strength_mpa=27.0)
    ).json()
    return contractor_token, qe_token, pid, test["ncr_id"]


def _patch_ncr(client, token, pid, ncr_id, **body):
    return client.patch(
        f"{API}/projects/{pid}/ncrs/{ncr_id}", json=body, headers=bearer(token)
    )


def _add_action(client, token, pid, ncr_id, **body):
    body.setdefault("action_description", "Re-pour the affected slab section")
    return client.post(
        f"{API}/projects/{pid}/ncrs/{ncr_id}/corrective-actions",
        json=body,
        headers=bearer(token),
    )


def _order_retest(client, token, pid, ncr_id, **body):
    body.setdefault("retest_type", "CORE_CUTTING")
    return client.post(
        f"{API}/projects/{pid}/ncrs/{ncr_id}/retests",
        json=body,
        headers=bearer(token),
    )


def _notify_rmc(client, token, pid, ncr_id, **body):
    return client.post(
        f"{API}/projects/{pid}/ncrs/{ncr_id}/notify-rmc",
        json=body,
        headers=bearer(token),
    )


class TestNCRLifecycle:
    async def test_new_ncr_starts_open(self, client, db_session):
        _, qe_token, pid, ncr_id = await _open_ncr(client, db_session)
        ncr = (
            await client.get(
                f"{API}/projects/{pid}/ncrs/{ncr_id}", headers=bearer(qe_token)
            )
        ).json()
        assert ncr["status"] == "OPEN"
        assert ncr["closed_at"] is None
        assert ncr["corrective_actions"] == []
        assert ncr["retests"] == []
        assert ncr["rmc_notifications"] == []

    async def test_review_records_status_and_root_cause(self, client, db_session):
        _, qe_token, pid, ncr_id = await _open_ncr(client, db_session)
        resp = await _patch_ncr(
            client, qe_token, pid, ncr_id,
            status="UNDER_REVIEW", root_cause="Low cement content in the mix",
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["status"] == "UNDER_REVIEW"
        assert body["root_cause"] == "Low cement content in the mix"

    async def test_cannot_skip_review_and_close_directly(self, client, db_session):
        _, qe_token, pid, ncr_id = await _open_ncr(client, db_session)
        resp = await _patch_ncr(client, qe_token, pid, ncr_id, status="CLOSED")
        assert resp.status_code == 400

    async def test_close_requires_a_root_cause(self, client, db_session):
        _, qe_token, pid, ncr_id = await _open_ncr(client, db_session)
        await _patch_ncr(client, qe_token, pid, ncr_id, status="UNDER_REVIEW")
        resp = await _patch_ncr(client, qe_token, pid, ncr_id, status="CLOSED")
        assert resp.status_code == 400
        assert "root cause" in resp.json()["detail"].lower()

    async def test_close_blocked_until_actions_completed(self, client, db_session):
        _, qe_token, pid, ncr_id = await _open_ncr(client, db_session)
        await _patch_ncr(
            client, qe_token, pid, ncr_id, status="UNDER_REVIEW", root_cause="Bad batch"
        )
        action_id = (await _add_action(client, qe_token, pid, ncr_id)).json()["action_id"]

        blocked = await _patch_ncr(client, qe_token, pid, ncr_id, status="CLOSED")
        assert blocked.status_code == 400
        assert "corrective action" in blocked.json()["detail"].lower()

        await client.patch(
            f"{API}/projects/{pid}/ncrs/{ncr_id}/corrective-actions/{action_id}",
            json={"status": "COMPLETED"},
            headers=bearer(qe_token),
        )
        closed = await _patch_ncr(client, qe_token, pid, ncr_id, status="CLOSED")
        assert closed.status_code == 200, closed.text
        assert closed.json()["status"] == "CLOSED"
        assert closed.json()["closed_at"] is not None

    async def test_close_with_no_actions_just_needs_root_cause(self, client, db_session):
        _, qe_token, pid, ncr_id = await _open_ncr(client, db_session)
        await _patch_ncr(
            client, qe_token, pid, ncr_id, status="UNDER_REVIEW", root_cause="Curing gap"
        )
        resp = await _patch_ncr(client, qe_token, pid, ncr_id, status="CLOSED")
        assert resp.status_code == 200, resp.text
        assert resp.json()["status"] == "CLOSED"

    async def test_reopen_clears_closed_at(self, client, db_session):
        _, qe_token, pid, ncr_id = await _open_ncr(client, db_session)
        await _patch_ncr(
            client, qe_token, pid, ncr_id, status="UNDER_REVIEW", root_cause="x"
        )
        await _patch_ncr(client, qe_token, pid, ncr_id, status="CLOSED")
        resp = await _patch_ncr(client, qe_token, pid, ncr_id, status="UNDER_REVIEW")
        assert resp.status_code == 200
        assert resp.json()["status"] == "UNDER_REVIEW"
        assert resp.json()["closed_at"] is None

    async def test_cannot_edit_root_cause_of_closed_ncr(self, client, db_session):
        """A CLOSED NCR is frozen — its root cause can't be amended without
        reopening (mirrors the corrective-action/retest freeze)."""
        _, qe_token, pid, ncr_id = await _open_ncr(client, db_session)
        await _patch_ncr(
            client, qe_token, pid, ncr_id, status="UNDER_REVIEW", root_cause="Low cement"
        )
        await _patch_ncr(client, qe_token, pid, ncr_id, status="CLOSED")

        blocked = await _patch_ncr(client, qe_token, pid, ncr_id, root_cause="amended")
        assert blocked.status_code == 400, blocked.text

        # Reopening makes it editable again.
        await _patch_ncr(client, qe_token, pid, ncr_id, status="UNDER_REVIEW")
        ok = await _patch_ncr(client, qe_token, pid, ncr_id, root_cause="amended")
        assert ok.status_code == 200, ok.text
        assert ok.json()["root_cause"] == "amended"

    async def test_non_qe_cannot_update_ncr(self, client, db_session):
        contractor_token, _, pid, ncr_id = await _open_ncr(client, db_session)
        resp = await _patch_ncr(
            client, contractor_token, pid, ncr_id, status="UNDER_REVIEW"
        )
        assert resp.status_code == 403

    async def test_update_unknown_ncr_is_404(self, client, db_session):
        _, qe_token, pid, _ = await _open_ncr(client, db_session)
        resp = await _patch_ncr(client, qe_token, pid, 999999, status="UNDER_REVIEW")
        assert resp.status_code == 404


class TestCorrectiveActions:
    async def test_add_action_appears_in_detail_with_counts(self, client, db_session):
        _, qe_token, pid, ncr_id = await _open_ncr(client, db_session)
        resp = await _add_action(client, qe_token, pid, ncr_id)
        assert resp.status_code == 201, resp.text
        assert resp.json()["status"] == "PENDING"

        ncr = (
            await client.get(
                f"{API}/projects/{pid}/ncrs/{ncr_id}", headers=bearer(qe_token)
            )
        ).json()
        assert ncr["corrective_action_count"] == 1
        assert ncr["open_action_count"] == 1
        assert len(ncr["corrective_actions"]) == 1

    async def test_completing_action_drops_open_count(self, client, db_session):
        _, qe_token, pid, ncr_id = await _open_ncr(client, db_session)
        action_id = (await _add_action(client, qe_token, pid, ncr_id)).json()["action_id"]
        resp = await client.patch(
            f"{API}/projects/{pid}/ncrs/{ncr_id}/corrective-actions/{action_id}",
            json={"status": "COMPLETED"},
            headers=bearer(qe_token),
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "COMPLETED"

        ncr = (
            await client.get(
                f"{API}/projects/{pid}/ncrs/{ncr_id}", headers=bearer(qe_token)
            )
        ).json()
        assert ncr["open_action_count"] == 0

    async def test_cannot_add_action_to_closed_ncr(self, client, db_session):
        _, qe_token, pid, ncr_id = await _open_ncr(client, db_session)
        await _patch_ncr(
            client, qe_token, pid, ncr_id, status="UNDER_REVIEW", root_cause="x"
        )
        await _patch_ncr(client, qe_token, pid, ncr_id, status="CLOSED")
        resp = await _add_action(client, qe_token, pid, ncr_id)
        assert resp.status_code == 400

    async def test_non_qe_cannot_add_action(self, client, db_session):
        contractor_token, _, pid, ncr_id = await _open_ncr(client, db_session)
        resp = await _add_action(client, contractor_token, pid, ncr_id)
        assert resp.status_code == 403


class TestRetests:
    async def test_order_retest_appears_in_detail(self, client, db_session):
        _, qe_token, pid, ncr_id = await _open_ncr(client, db_session)
        resp = await _order_retest(client, qe_token, pid, ncr_id, retest_type="CORE_CUTTING")
        assert resp.status_code == 201, resp.text
        assert resp.json()["retest_type"] == "CORE_CUTTING"
        assert resp.json()["result"] is None  # pending until a result is recorded
        retest_id = resp.json()["retest_id"]

        ncr = (
            await client.get(
                f"{API}/projects/{pid}/ncrs/{ncr_id}", headers=bearer(qe_token)
            )
        ).json()
        assert ncr["retest_count"] == 1
        assert ncr["open_retest_count"] == 1
        assert ncr["retests"][0]["retest_id"] == retest_id

    async def test_record_retest_result_completes_it(self, client, db_session):
        _, qe_token, pid, ncr_id = await _open_ncr(client, db_session)
        retest_id = (await _order_retest(client, qe_token, pid, ncr_id)).json()["retest_id"]
        resp = await client.patch(
            f"{API}/projects/{pid}/ncrs/{ncr_id}/retests/{retest_id}",
            json={
                "result": "PASS", "observed_strength_mpa": 31.5,
                "required_strength_mpa": 30.0, "test_date": "2026-08-20",
            },
            headers=bearer(qe_token),
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["result"] == "PASS"
        assert resp.json()["completed_at"] is not None

        ncr = (
            await client.get(
                f"{API}/projects/{pid}/ncrs/{ncr_id}", headers=bearer(qe_token)
            )
        ).json()
        assert ncr["open_retest_count"] == 0

    async def test_retest_lists_on_project_retests_page(self, client, db_session):
        _, qe_token, pid, ncr_id = await _open_ncr(client, db_session)
        await _order_retest(client, qe_token, pid, ncr_id)
        rows = (
            await client.get(f"{API}/projects/{pid}/retests", headers=bearer(qe_token))
        ).json()
        assert len(rows) == 1
        assert rows[0]["ncr_id"] == ncr_id
        assert rows[0]["grade_name"] == "M30"

    async def test_cannot_order_retest_on_closed_ncr(self, client, db_session):
        _, qe_token, pid, ncr_id = await _open_ncr(client, db_session)
        await _patch_ncr(client, qe_token, pid, ncr_id, status="UNDER_REVIEW", root_cause="x")
        await _patch_ncr(client, qe_token, pid, ncr_id, status="CLOSED")
        resp = await _order_retest(client, qe_token, pid, ncr_id)
        assert resp.status_code == 400

    async def test_non_qe_cannot_order_retest(self, client, db_session):
        contractor_token, _, pid, ncr_id = await _open_ncr(client, db_session)
        resp = await _order_retest(client, contractor_token, pid, ncr_id)
        assert resp.status_code == 403


class TestRmcNotification:
    async def test_notify_rmc_logs_notification(self, client, db_session):
        _, qe_token, pid, ncr_id = await _open_ncr(client, db_session)
        resp = await _notify_rmc(
            client, qe_token, pid, ncr_id,
            subject="NCR raised on your supply", message="Please review the batch records.",
        )
        assert resp.status_code == 201, resp.text
        assert resp.json()["subject"] == "NCR raised on your supply"
        assert resp.json()["supplier_name"] == "UltraTech RMC"

        ncr = (
            await client.get(
                f"{API}/projects/{pid}/ncrs/{ncr_id}", headers=bearer(qe_token)
            )
        ).json()
        assert len(ncr["rmc_notifications"]) == 1

    async def test_notify_rmc_auto_composes_a_body_when_blank(self, client, db_session):
        _, qe_token, pid, ncr_id = await _open_ncr(client, db_session)
        resp = await _notify_rmc(client, qe_token, pid, ncr_id)
        assert resp.status_code == 201, resp.text
        # An auto-composed subject + message are filled in from the NCR context.
        assert resp.json()["subject"]
        assert "MPa" in resp.json()["message"]

    async def test_non_qe_cannot_notify_rmc(self, client, db_session):
        contractor_token, _, pid, ncr_id = await _open_ncr(client, db_session)
        resp = await _notify_rmc(client, contractor_token, pid, ncr_id)
        assert resp.status_code == 403


class TestNCRListSummary:
    async def test_list_carries_lifecycle_counts(self, client, db_session):
        _, qe_token, pid, ncr_id = await _open_ncr(client, db_session)
        await _add_action(client, qe_token, pid, ncr_id)
        await _order_retest(client, qe_token, pid, ncr_id)
        rows = (
            await client.get(f"{API}/projects/{pid}/ncrs", headers=bearer(qe_token))
        ).json()
        assert len(rows) == 1
        assert rows[0]["corrective_action_count"] == 1
        assert rows[0]["open_action_count"] == 1
        assert rows[0]["retest_count"] == 1
        assert rows[0]["open_retest_count"] == 1
