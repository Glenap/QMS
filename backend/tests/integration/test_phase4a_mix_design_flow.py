"""
Integration tests for Phase 4A — RMC-owned, QE-approved mix designs:

  contractor requests grades from a supplier → the RMC submits a mix design per
  grade through its tokenised link (PENDING) → the QE reviews (approve / reject
  with reason / in-progress, recording the observed 28-day strength) → only an
  APPROVED mix's grade may be poured.
"""

from tests.helpers import API, bearer
from tests.integration.test_phase2_pour_flow import _project_with_qe


async def _supplier(client, contractor_token, pid):
    return (
        await client.post(
            f"{API}/projects/{pid}/suppliers",
            json={"supplier_name": "UltraTech RMC"},
            headers=bearer(contractor_token),
        )
    ).json()


async def _grade(client, token, name="M30"):
    grades = (await client.get(f"{API}/grades", headers=bearer(token))).json()
    return next(g for g in grades if g["grade_name"] == name)


async def _request_and_token(client, contractor_token, pid, supplier_id, grade_ids):
    await client.put(
        f"{API}/projects/{pid}/suppliers/{supplier_id}/required-grades",
        json={"grade_ids": grade_ids},
        headers=bearer(contractor_token),
    )
    sups = (
        await client.get(f"{API}/projects/{pid}/suppliers", headers=bearer(contractor_token))
    ).json()
    return next(
        s["mix_submission_token"] for s in sups if s["supplier_id"] == supplier_id
    )


async def _submit(client, token, grade_id, **fields):
    return await client.post(
        f"{API}/external/mix-design?token={token}",
        json={"grade_id": grade_id, **fields},
    )


class TestRequiredGrades:
    async def test_set_required_grades_mints_token(self, client, db_session):
        contractor_token, _, pid = await _project_with_qe(client, db_session)
        sup = await _supplier(client, contractor_token, pid)
        m30 = await _grade(client, contractor_token)

        info = (
            await client.put(
                f"{API}/projects/{pid}/suppliers/{sup['supplier_id']}/required-grades",
                json={"grade_ids": [m30["grade_id"]]},
                headers=bearer(contractor_token),
            )
        ).json()
        assert [g["grade_id"] for g in info] == [m30["grade_id"]]
        assert info[0]["mix_design_id"] is None  # nothing submitted yet

        sups = (
            await client.get(f"{API}/projects/{pid}/suppliers", headers=bearer(contractor_token))
        ).json()
        token = next(
            s["mix_submission_token"]
            for s in sups
            if s["supplier_id"] == sup["supplier_id"]
        )
        assert token

    async def test_required_grades_public_view(self, client, db_session):
        contractor_token, _, pid = await _project_with_qe(client, db_session)
        sup = await _supplier(client, contractor_token, pid)
        m30 = await _grade(client, contractor_token)
        token = await _request_and_token(
            client, contractor_token, pid, sup["supplier_id"], [m30["grade_id"]]
        )
        view = await client.get(f"{API}/external/mix-design?token={token}")
        assert view.status_code == 200, view.text
        body = view.json()
        assert body["supplier_name"] == "UltraTech RMC"
        assert [g["grade_name"] for g in body["required_grades"]] == ["M30"]


class TestSubmission:
    async def test_rmc_submits_pending_then_qe_approves(self, client, db_session):
        contractor_token, qe_token, pid = await _project_with_qe(client, db_session)
        sup = await _supplier(client, contractor_token, pid)
        m30 = await _grade(client, contractor_token)
        token = await _request_and_token(
            client, contractor_token, pid, sup["supplier_id"], [m30["grade_id"]]
        )

        submitted = await _submit(
            client, token, m30["grade_id"], wc_ratio=0.42, slump_range_mm="100-150"
        )
        assert submitted.status_code == 200, submitted.text
        mid = submitted.json()["mix_design_id"]
        assert submitted.json()["approval_status"] == "PENDING"
        assert submitted.json()["wc_ratio"] == 0.42

        # Not approved yet → its grade can't be poured.
        approved = (
            await client.get(
                f"{API}/projects/{pid}/mix-designs/approved-grades",
                headers=bearer(qe_token),
            )
        ).json()
        assert approved == []

        reviewed = await client.patch(
            f"{API}/projects/{pid}/mix-designs/{mid}/review",
            json={"approval_status": "APPROVED", "observed_28day_strength_mpa": 38.5},
            headers=bearer(qe_token),
        )
        assert reviewed.status_code == 200, reviewed.text
        assert reviewed.json()["approval_status"] == "APPROVED"
        assert reviewed.json()["observed_28day_strength_mpa"] == 38.5

        approved = (
            await client.get(
                f"{API}/projects/{pid}/mix-designs/approved-grades",
                headers=bearer(qe_token),
            )
        ).json()
        assert [g["grade_name"] for g in approved] == ["M30"]

    async def test_submit_unrequested_grade_is_forbidden(self, client, db_session):
        contractor_token, _, pid = await _project_with_qe(client, db_session)
        sup = await _supplier(client, contractor_token, pid)
        m30 = await _grade(client, contractor_token, "M30")
        m25 = await _grade(client, contractor_token, "M25")
        token = await _request_and_token(
            client, contractor_token, pid, sup["supplier_id"], [m30["grade_id"]]
        )
        resp = await _submit(client, token, m25["grade_id"])
        assert resp.status_code == 403

    async def test_resubmission_resets_to_pending(self, client, db_session):
        contractor_token, qe_token, pid = await _project_with_qe(client, db_session)
        sup = await _supplier(client, contractor_token, pid)
        m30 = await _grade(client, contractor_token)
        token = await _request_and_token(
            client, contractor_token, pid, sup["supplier_id"], [m30["grade_id"]]
        )
        mid = (await _submit(client, token, m30["grade_id"])).json()["mix_design_id"]
        await client.patch(
            f"{API}/projects/{pid}/mix-designs/{mid}/review",
            json={"approval_status": "APPROVED"},
            headers=bearer(qe_token),
        )
        again = await _submit(client, token, m30["grade_id"], wc_ratio=0.40)
        assert again.json()["mix_design_id"] == mid  # updated, not duplicated
        assert again.json()["approval_status"] == "PENDING"
        assert again.json()["wc_ratio"] == 0.40


class TestReview:
    async def test_reject_records_reason(self, client, db_session):
        contractor_token, qe_token, pid = await _project_with_qe(client, db_session)
        sup = await _supplier(client, contractor_token, pid)
        m30 = await _grade(client, contractor_token)
        token = await _request_and_token(
            client, contractor_token, pid, sup["supplier_id"], [m30["grade_id"]]
        )
        mid = (await _submit(client, token, m30["grade_id"])).json()["mix_design_id"]

        rejected = await client.patch(
            f"{API}/projects/{pid}/mix-designs/{mid}/review",
            json={"approval_status": "REJECTED", "rejection_reason": "w/c ratio too high"},
            headers=bearer(qe_token),
        )
        assert rejected.status_code == 200, rejected.text
        assert rejected.json()["approval_status"] == "REJECTED"
        assert rejected.json()["rejection_reason"] == "w/c ratio too high"

    async def test_non_qe_cannot_review(self, client, db_session):
        contractor_token, _, pid = await _project_with_qe(client, db_session)
        sup = await _supplier(client, contractor_token, pid)
        m30 = await _grade(client, contractor_token)
        token = await _request_and_token(
            client, contractor_token, pid, sup["supplier_id"], [m30["grade_id"]]
        )
        mid = (await _submit(client, token, m30["grade_id"])).json()["mix_design_id"]
        resp = await client.patch(
            f"{API}/projects/{pid}/mix-designs/{mid}/review",
            json={"approval_status": "APPROVED"},
            headers=bearer(contractor_token),
        )
        assert resp.status_code == 403
