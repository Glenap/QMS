"""
Integration tests for Phase 4 — cube samples, lab-dispatched strength tests,
and auto-NCRs:

  QE casts a cube sample from a pour → the lab submits the 7/14/28-day strength
  reports through a tokenised link → the quality engine grades each PASS / FAIL /
  CRITICAL_FAILURE → a failing **28-day** result auto-raises an NCR that surfaces
  in the project's NCR list.

Plus RBAC (only the QE casts samples), required-strength derivation by age, and
project scoping. ``_record_test`` is the shared helper reused by phases 5/6/9 —
it now drives the lab token flow (the QE no longer types results), assembling a
back-compatible result shape so downstream phases keep working.
"""

import secrets

from app.models.transaction import CubeSample
from tests.helpers import API, bearer
from tests.integration.test_phase3_dispatch_flow import _accepted_delivery, _create_pour

# The lab report PDF is mandatory on submission.
_PDF = {"file": ("report.pdf", b"%PDF-1.4 demo", "application/pdf")}


async def _qe_pour(client, db_session):
    """(contractor_token, qe_token, project_id, pour_id) — a pour recorded from an
    accepted delivery (M30, 30 m³, ref PC-001, pour_date 2026-07-15)."""
    contractor_token, qe_token, _sup, pid, refs, dispatch_id = await _accepted_delivery(
        client, db_session
    )
    pour = (
        await _create_pour(client, qe_token, pid, dispatch_id, refs)
    ).json()
    return contractor_token, qe_token, pid, pour["pour_id"]


async def _cast_sample(client, qe_token, pid, pour_id, **overrides):
    payload = {"cast_date": "2026-07-15", "no_of_cubes": 3, "sample_reference": "CS-001"}
    payload.update(overrides)
    return await client.post(
        f"{API}/projects/{pid}/pours/{pour_id}/samples",
        json=payload,
        headers=bearer(qe_token),
    )


class _Shim:
    """Mimics an httpx Response for the legacy ``(await _record_test(...)).json()``
    call shape, carrying the persisted cube-test row (result + any auto-NCR)."""

    def __init__(self, status_code: int, payload: dict):
        self.status_code = status_code
        self._payload = payload

    def json(self) -> dict:
        return self._payload


async def _report_token(db_session, sample_id: int) -> str:
    """The sample's lab report token, minting one directly if absent (the
    production token is issued + emailed when a lab is assigned at cast time)."""
    sample = await db_session.get(CubeSample, sample_id)
    if not sample.report_token:
        sample.report_token = "rt-" + secrets.token_urlsafe(12)
        await db_session.flush()
    return sample.report_token


async def _record_test(
    client, db_session, qe_token, pid, sample_id,
    *, test_age_days=28, test_date=None, observed_strength_mpa=32.0, **_ignored,
):
    """Submit a milestone strength report through the public lab token flow and
    return a ``_Shim`` of the resulting cube-test row (so callers can read
    ``result_status`` / ``ncr_id`` exactly as before)."""
    token = await _report_token(db_session, sample_id)
    await client.post(
        f"{API}/external/lab-report/start?token={token}",
        json={"testing_started_on": "2026-07-15"},
    )
    form = {
        "test_age_days": str(test_age_days),
        "observed_strength_mpa": str(observed_strength_mpa),
    }
    if test_date:
        form["test_date"] = test_date
    resp = await client.post(
        f"{API}/external/lab-report?token={token}",
        data=form,
        files={"file": ("report.pdf", b"%PDF-1.4 report", "application/pdf")},
    )
    if resp.status_code != 200:
        return resp
    samples = (
        await client.get(f"{API}/projects/{pid}/samples", headers=bearer(qe_token))
    ).json()
    row = next(s for s in samples if s["sample_id"] == sample_id)
    test = next(t for t in row["tests"] if t["test_age_days"] == test_age_days)
    return _Shim(201, test)


class TestCubeSamples:
    async def test_qe_casts_sample_with_pour_context(self, client, db_session):
        _, qe_token, pid, pour_id = await _qe_pour(client, db_session)
        resp = await _cast_sample(client, qe_token, pid, pour_id)
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["sample_reference"] == "CS-001"
        assert body["grade_name"] == "M30"
        assert body["tower_name"]
        assert body["tests"] == []

    async def test_non_qe_cannot_cast_sample(self, client, db_session):
        contractor_token, _, pid, pour_id = await _qe_pour(client, db_session)
        resp = await _cast_sample(client, contractor_token, pid, pour_id)
        assert resp.status_code == 403

    async def test_sample_on_unknown_pour_is_404(self, client, db_session):
        _, qe_token, pid, _ = await _qe_pour(client, db_session)
        resp = await _cast_sample(client, qe_token, pid, 999999)
        assert resp.status_code == 404

    async def test_sample_appears_in_project_list(self, client, db_session):
        _, qe_token, pid, pour_id = await _qe_pour(client, db_session)
        await _cast_sample(client, qe_token, pid, pour_id)
        rows = (
            await client.get(f"{API}/projects/{pid}/samples", headers=bearer(qe_token))
        ).json()
        assert len(rows) == 1
        assert rows[0]["sample_reference"] == "CS-001"


class TestCubeTests:
    async def test_passing_28_day_test_raises_no_ncr(self, client, db_session):
        _, qe_token, pid, pour_id = await _qe_pour(client, db_session)
        sample_id = (await _cast_sample(client, qe_token, pid, pour_id)).json()["sample_id"]
        # M30, 28-day → required 30.0; observed 32.0 → PASS.
        resp = await _record_test(
            client, db_session, qe_token, pid, sample_id, observed_strength_mpa=32.0
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["required_strength_mpa"] == 30.0
        assert body["result_status"] == "PASS"
        assert body["ncr_id"] is None
        # The result was submitted by the lab, not a logged-in user.
        assert body["submitted_by_lab"] is True

    async def test_failing_28_day_test_auto_raises_ncr(self, client, db_session):
        _, qe_token, pid, pour_id = await _qe_pour(client, db_session)
        sample_id = (await _cast_sample(client, qe_token, pid, pour_id)).json()["sample_id"]
        # M30, 28-day → required 30.0; observed 27.0 (>= 85% = 25.5) → FAIL.
        resp = await _record_test(
            client, db_session, qe_token, pid, sample_id, observed_strength_mpa=27.0
        )
        body = resp.json()
        assert body["result_status"] == "FAIL"
        assert body["ncr_id"] is not None
        assert body["ncr_number"].startswith("NCR-")

        ncrs = (
            await client.get(f"{API}/projects/{pid}/ncrs", headers=bearer(qe_token))
        ).json()
        assert len(ncrs) == 1
        assert ncrs[0]["result_status"] == "FAIL"
        assert ncrs[0]["grade_name"] == "M30"
        assert ncrs[0]["status"] == "OPEN"

    async def test_critical_failure_below_85_percent(self, client, db_session):
        _, qe_token, pid, pour_id = await _qe_pour(client, db_session)
        sample_id = (await _cast_sample(client, qe_token, pid, pour_id)).json()["sample_id"]
        # observed 20.0 < 85% of 30 (25.5) → CRITICAL_FAILURE, NCR raised (28-day).
        resp = await _record_test(
            client, db_session, qe_token, pid, sample_id, observed_strength_mpa=20.0
        )
        body = resp.json()
        assert body["result_status"] == "CRITICAL_FAILURE"
        assert body["ncr_id"] is not None

    async def test_failing_7_day_report_raises_no_ncr(self, client, db_session):
        """The 28-day test is the acceptance criterion — an early-age miss is
        recorded and visible but does NOT open a non-conformance."""
        _, qe_token, pid, pour_id = await _qe_pour(client, db_session)
        sample_id = (await _cast_sample(client, qe_token, pid, pour_id)).json()["sample_id"]
        # M30, 7-day → required 19.5; observed 17.0 (>= 85% = 16.575) → FAIL.
        resp = await _record_test(
            client, db_session, qe_token, pid, sample_id,
            test_age_days=7, observed_strength_mpa=17.0,
        )
        body = resp.json()
        assert body["result_status"] == "FAIL"
        assert body["ncr_id"] is None

        ncrs = (
            await client.get(f"{API}/projects/{pid}/ncrs", headers=bearer(qe_token))
        ).json()
        assert ncrs == []

    async def test_7_day_required_is_65_percent(self, client, db_session):
        _, qe_token, pid, pour_id = await _qe_pour(client, db_session)
        sample_id = (await _cast_sample(client, qe_token, pid, pour_id)).json()["sample_id"]
        # M30, 7-day → required 19.5; observed 22.0 → PASS.
        resp = await _record_test(
            client, db_session, qe_token, pid, sample_id,
            test_age_days=7, test_date="2026-07-22", observed_strength_mpa=22.0,
        )
        body = resp.json()
        assert body["required_strength_mpa"] == 19.5
        assert body["result_status"] == "PASS"

    async def test_recorded_test_shows_under_its_sample(self, client, db_session):
        _, qe_token, pid, pour_id = await _qe_pour(client, db_session)
        sample_id = (await _cast_sample(client, qe_token, pid, pour_id)).json()["sample_id"]
        await _record_test(
            client, db_session, qe_token, pid, sample_id, observed_strength_mpa=27.0
        )
        samples = (
            await client.get(f"{API}/projects/{pid}/samples", headers=bearer(qe_token))
        ).json()
        tests = samples[0]["tests"]
        assert len(tests) == 1
        assert tests[0]["result_status"] == "FAIL"
        # The auto-raised NCR is reachable from the test row.
        assert tests[0]["ncr_id"] is not None


class TestLabReportFlow:
    """The public, tokenised lab report submission path."""

    async def test_view_then_start_then_submit_milestones(self, client, db_session):
        _, qe_token, pid, pour_id = await _qe_pour(client, db_session)
        sample_id = (await _cast_sample(client, qe_token, pid, pour_id)).json()["sample_id"]
        token = await _report_token(db_session, sample_id)

        # Before the testing day is set, the schedule has no due dates.
        view = (await client.get(f"{API}/external/lab-report?token={token}")).json()
        assert view["testing_started_on"] is None
        assert [m["test_age_days"] for m in view["milestones"]] == [7, 14, 28]
        assert all(m["due_date"] is None and not m["submitted"] for m in view["milestones"])

        # Establishing the testing day anchors the 7/14/28-day due dates.
        started = await client.post(
            f"{API}/external/lab-report/start?token={token}",
            json={"testing_started_on": "2026-07-15"},
        )
        assert started.status_code == 200, started.text
        due = {m["test_age_days"]: m["due_date"] for m in started.json()["milestones"]}
        assert due == {7: "2026-07-22", 14: "2026-07-29", 28: "2026-08-12"}

        # 7-day report: a miss is recorded but raises no NCR.
        r7 = await client.post(
            f"{API}/external/lab-report?token={token}",
            data={"test_age_days": "7", "observed_strength_mpa": "17.0"},
            files=_PDF,
        )
        assert r7.status_code == 200, r7.text
        assert r7.json()["result_status"] == "FAIL"
        assert r7.json()["ncr_raised"] is False

        # 28-day acceptance report fails → NCR raised.
        r28 = await client.post(
            f"{API}/external/lab-report?token={token}",
            data={"test_age_days": "28", "observed_strength_mpa": "27.0"},
            files=_PDF,
        )
        assert r28.json()["ncr_raised"] is True

        ncrs = (
            await client.get(f"{API}/projects/{pid}/ncrs", headers=bearer(qe_token))
        ).json()
        assert len(ncrs) == 1

    async def test_cannot_submit_before_testing_day(self, client, db_session):
        _, qe_token, pid, pour_id = await _qe_pour(client, db_session)
        sample_id = (await _cast_sample(client, qe_token, pid, pour_id)).json()["sample_id"]
        token = await _report_token(db_session, sample_id)
        resp = await client.post(
            f"{API}/external/lab-report?token={token}",
            data={"test_age_days": "7", "observed_strength_mpa": "20.0"},
            files=_PDF,
        )
        assert resp.status_code == 400

    async def test_milestone_cannot_be_submitted_twice(self, client, db_session):
        _, qe_token, pid, pour_id = await _qe_pour(client, db_session)
        sample_id = (await _cast_sample(client, qe_token, pid, pour_id)).json()["sample_id"]
        token = await _report_token(db_session, sample_id)
        await client.post(
            f"{API}/external/lab-report/start?token={token}",
            json={"testing_started_on": "2026-07-15"},
        )
        form = {"test_age_days": "28", "observed_strength_mpa": "32.0"}
        first = await client.post(f"{API}/external/lab-report?token={token}", data=form, files=_PDF)
        assert first.status_code == 200
        again = await client.post(f"{API}/external/lab-report?token={token}", data=form, files=_PDF)
        assert again.status_code == 400

    async def test_unknown_age_is_rejected(self, client, db_session):
        _, qe_token, pid, pour_id = await _qe_pour(client, db_session)
        sample_id = (await _cast_sample(client, qe_token, pid, pour_id)).json()["sample_id"]
        token = await _report_token(db_session, sample_id)
        await client.post(
            f"{API}/external/lab-report/start?token={token}",
            json={"testing_started_on": "2026-07-15"},
        )
        resp = await client.post(
            f"{API}/external/lab-report?token={token}",
            data={"test_age_days": "21", "observed_strength_mpa": "30.0"},
            files=_PDF,
        )
        assert resp.status_code == 400

    async def test_unknown_token_is_404(self, client, db_session):
        resp = await client.get(f"{API}/external/lab-report?token=does-not-exist")
        assert resp.status_code == 404

    async def test_submitted_pdf_is_linked_to_the_test(self, client, db_session):
        _, qe_token, pid, pour_id = await _qe_pour(client, db_session)
        sample_id = (await _cast_sample(client, qe_token, pid, pour_id)).json()["sample_id"]
        token = await _report_token(db_session, sample_id)
        await client.post(
            f"{API}/external/lab-report/start?token={token}",
            json={"testing_started_on": "2026-07-15"},
        )
        resp = await client.post(
            f"{API}/external/lab-report?token={token}",
            data={"test_age_days": "28", "observed_strength_mpa": "32.0"},
            files={"file": ("report.pdf", b"%PDF-1.4 fake", "application/pdf")},
        )
        assert resp.status_code == 200, resp.text

        samples = (
            await client.get(f"{API}/projects/{pid}/samples", headers=bearer(qe_token))
        ).json()
        test = samples[0]["tests"][0]
        assert test["report_document_id"] is not None
        # The QE can download the lab's PDF through the project document store.
        dl = await client.get(
            f"{API}/projects/{pid}/documents/{test['report_document_id']}/download",
            headers=bearer(qe_token),
        )
        assert dl.status_code == 200

    async def test_resend_requires_a_lab(self, client, db_session):
        _, qe_token, pid, pour_id = await _qe_pour(client, db_session)
        sample_id = (await _cast_sample(client, qe_token, pid, pour_id)).json()["sample_id"]
        resp = await client.post(
            f"{API}/projects/{pid}/samples/{sample_id}/resend-report-link",
            headers=bearer(qe_token),
        )
        assert resp.status_code == 400

    async def test_resend_is_qe_only(self, client, db_session):
        contractor_token, qe_token, pid, pour_id = await _qe_pour(client, db_session)
        sample_id = (await _cast_sample(client, qe_token, pid, pour_id)).json()["sample_id"]
        resp = await client.post(
            f"{API}/projects/{pid}/samples/{sample_id}/resend-report-link",
            headers=bearer(contractor_token),
        )
        assert resp.status_code == 403
