"""
Integration tests for Phase 5C — IS-456/10262 quality alerts + the RMC-issue email:

  Quality alerts are scoped to what NCRs don't already catch. A single failing
  28-day result auto-raises an NCR (not an alert); the alert feed surfaces only
  the IS-456 **group** signal — a run of individually-passing results whose
  4-sample moving average drifts below the acceptance floor. The QE + PM read the
  feed, acknowledge, and can email the RMC about the issue.
"""

from tests.helpers import API, bearer
from tests.integration.test_phase4_cube_flow import _cast_sample, _qe_pour, _record_test


async def _result(client, db_session, observed):
    contractor_token, qe_token, pid, pour_id = await _qe_pour(client, db_session)  # M30
    sample_id = (await _cast_sample(client, qe_token, pid, pour_id)).json()["sample_id"]
    await _record_test(
        client, db_session, qe_token, pid, sample_id, observed_strength_mpa=observed
    )
    return contractor_token, qe_token, pid, pour_id


class TestStrengthAlerts:
    async def test_individual_failure_raises_ncr_not_alert(self, client, db_session):
        # A failing 28-day result (< fck−3) auto-raises an NCR — surfacing it as an
        # alert too would just duplicate the NCR, so the alert feed stays empty.
        _, qe_token, pid, _ = await _result(client, db_session, observed=20.0)
        alerts = (
            await client.get(f"{API}/projects/{pid}/alerts", headers=bearer(qe_token))
        ).json()
        assert alerts == []
        ncrs = (
            await client.get(f"{API}/projects/{pid}/ncrs", headers=bearer(qe_token))
        ).json()
        assert len(ncrs) == 1

    async def test_group_average_drift_alerts_and_can_be_acknowledged(self, client, db_session):
        # Four individually-passing M30 results (33 ≥ fck 30, so no NCRs) whose
        # 4-sample mean 33.0 < the 34.12 acceptance floor → one STRENGTH_GROUP alert.
        contractor_token, qe_token, pid, pour_id = await _qe_pour(client, db_session)
        for i in range(4):
            sid = (
                await _cast_sample(
                    client, qe_token, pid, pour_id, sample_reference=f"CS-{i}"
                )
            ).json()["sample_id"]
            await _record_test(
                client, db_session, qe_token, pid, sid, observed_strength_mpa=33.0
            )

        alerts = (
            await client.get(f"{API}/projects/{pid}/alerts", headers=bearer(qe_token))
        ).json()
        assert all(a["category"] == "STRENGTH_GROUP" for a in alerts)
        assert len(alerts) == 1
        # No NCRs — every individual result passed.
        ncrs = (
            await client.get(f"{API}/projects/{pid}/ncrs", headers=bearer(qe_token))
        ).json()
        assert ncrs == []

        aid = alerts[0]["alert_id"]
        ack = await client.post(
            f"{API}/projects/{pid}/alerts/{aid}/acknowledge", headers=bearer(qe_token)
        )
        assert ack.json()["status"] == "ACKNOWLEDGED"
        assert (
            await client.get(f"{API}/projects/{pid}/alerts/count", headers=bearer(qe_token))
        ).json()["count"] == 0

    async def test_healthy_result_raises_no_alert(self, client, db_session):
        _, qe_token, pid, _ = await _result(client, db_session, observed=38.0)  # ≥ fck
        alerts = (
            await client.get(f"{API}/projects/{pid}/alerts", headers=bearer(qe_token))
        ).json()
        assert alerts == []

    async def test_contractor_cannot_read_alerts(self, client, db_session):
        contractor_token, _, pid, _ = await _result(client, db_session, observed=20.0)
        resp = await client.get(f"{API}/projects/{pid}/alerts", headers=bearer(contractor_token))
        assert resp.status_code == 403


class TestRmcIssueEmail:
    async def test_qe_emails_the_rmc(self, client, db_session):
        _, qe_token, pid, pour_id = await _result(client, db_session, observed=20.0)
        pour = (
            await client.get(f"{API}/projects/{pid}/pours/{pour_id}", headers=bearer(qe_token))
        ).json()
        resp = await client.post(
            f"{API}/projects/{pid}/suppliers/{pour['supplier_horizontal_id']}/notify",
            json={"subject": "Strength drift", "message": "Please review your plant."},
            headers=bearer(qe_token),
        )
        assert resp.status_code == 204, resp.text
