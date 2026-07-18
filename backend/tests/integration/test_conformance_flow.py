"""Integration tests for the Conformance Analyser defect findings.

A conformance photo is uploaded to the document store, then the QE classifies it
against the defect taxonomy (upsert by document_id), lists, re-classifies (updates
in place), and deletes. Plus RBAC + project-scoping.
"""

from tests.helpers import API, bearer
from tests.integration.test_phase1_master_flow import _project_with_qe

_IMG = {"file": ("defect.jpg", b"\xff\xd8\xff\xe0 fake jpeg bytes", "image/jpeg")}


async def _upload_photo(client, qe_token, pid, doc_type="CONFORMANCE_POST"):
    resp = await client.post(
        f"{API}/projects/{pid}/documents",
        data={"document_type": doc_type},
        files=_IMG,
        headers=bearer(qe_token),
    )
    assert resp.status_code in (200, 201), resp.text
    return resp.json()["document_id"]


def _finding(doc_id, **over):
    body = {
        "document_id": doc_id,
        "phase": "POST",
        "defect_code": "seepage_rcc_no_corrosion",
        "defect_label": "Seepage — no corrosion",
        "severity": "MED",
        "remediation_choice": "A",
        "notes": "north wall",
    }
    body.update(over)
    return body


class TestConformanceFindings:
    async def test_classify_list_update_delete(self, client, db_session):
        _, qe_token, pid = await _project_with_qe(client, db_session)
        doc_id = await _upload_photo(client, qe_token, pid)

        # Classify.
        r = await client.put(
            f"{API}/projects/{pid}/conformance/findings",
            json=_finding(doc_id), headers=bearer(qe_token),
        )
        assert r.status_code == 200, r.text
        fid = r.json()["finding_id"]
        assert r.json()["defect_code"] == "seepage_rcc_no_corrosion"

        # Listed.
        rows = (
            await client.get(f"{API}/projects/{pid}/conformance/findings", headers=bearer(qe_token))
        ).json()
        assert len(rows) == 1 and rows[0]["finding_id"] == fid

        # Re-classify the same photo → upsert updates in place (same row, no dup).
        r2 = await client.put(
            f"{API}/projects/{pid}/conformance/findings",
            json=_finding(doc_id, defect_code="corrosion_exposed", severity="HIGH", remediation_choice="B"),
            headers=bearer(qe_token),
        )
        assert r2.status_code == 200
        assert r2.json()["finding_id"] == fid
        assert r2.json()["severity"] == "HIGH"
        rows2 = (
            await client.get(f"{API}/projects/{pid}/conformance/findings", headers=bearer(qe_token))
        ).json()
        assert len(rows2) == 1

        # Delete.
        d = await client.delete(
            f"{API}/projects/{pid}/conformance/findings/{fid}", headers=bearer(qe_token)
        )
        assert d.status_code == 204
        rows3 = (
            await client.get(f"{API}/projects/{pid}/conformance/findings", headers=bearer(qe_token))
        ).json()
        assert rows3 == []

    async def test_non_qe_cannot_classify(self, client, db_session):
        contractor_token, qe_token, pid = await _project_with_qe(client, db_session)
        doc_id = await _upload_photo(client, qe_token, pid)
        r = await client.put(
            f"{API}/projects/{pid}/conformance/findings",
            json=_finding(doc_id), headers=bearer(contractor_token),
        )
        assert r.status_code in (403, 404)

    async def test_photo_must_be_in_project(self, client, db_session):
        _, qe_token, pid = await _project_with_qe(client, db_session)
        r = await client.put(
            f"{API}/projects/{pid}/conformance/findings",
            json=_finding(999999), headers=bearer(qe_token),
        )
        assert r.status_code == 404
