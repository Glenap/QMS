"""
Integration tests for Phase 5C — IS-456/10262 quality alerts + the RMC-issue email:

  a 28-day cube result that fails the individual criterion (or drifts the moving
  average) raises an alert for the QE + PM; they read the feed, acknowledge, and
  can email the RMC about the issue.
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
    async def test_low_28day_raises_critical_alert(self, client, db_session):
        _, qe_token, pid, _ = await _result(client, db_session, observed=20.0)  # < fck−3
        alerts = (
            await client.get(f"{API}/projects/{pid}/alerts", headers=bearer(qe_token))
        ).json()
        assert len(alerts) == 1
        assert alerts[0]["level"] == "CRITICAL"
        assert alerts[0]["category"] == "STRENGTH_INDIVIDUAL"

        count = (
            await client.get(f"{API}/projects/{pid}/alerts/count", headers=bearer(qe_token))
        ).json()
        assert count["count"] == 1

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
