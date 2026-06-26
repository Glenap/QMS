"""Integration tests for Phase 9 — AISuggestion / RAG (LLM + embedder stubbed).

A deterministic fake LLM and a fake bag-of-words embedder are injected via the
``get_llm`` / ``get_embedder`` dependencies (autouse, so the real Ollama is never
hit), letting these exercise the real pipeline — retrieve similar CLOSED NCRs
over the embedding cache, prompt, persist, and the human-in-the-loop apply. The
retrieval itself runs the real services against real (deterministic) data.
"""

import hashlib
import json

import pytest

from app.ai.embeddings import get_embedder
from app.ai.llm import LLMReply, get_llm
from app.main import app
from tests.helpers import API, bearer
from tests.integration.test_phase4_cube_flow import (
    _cast_sample,
    _qe_pour,
    _record_test,
)
from tests.integration.test_phase5_ncr_flow import _add_action, _patch_ncr

# Canned model answer the fake LLM returns for a suggestion request.
_LLM_JSON = json.dumps(
    {
        "root_cause": "Low cement content from a batching-plant calibration error.",
        "corrective_actions": [
            "Re-calibrate the batching plant and verify mix proportions",
            "Core-test the affected slab to confirm in-situ strength",
        ],
        "confidence": "HIGH",
        "ndt_recommended": True,
    }
)


class FakeEmbedder:
    """Deterministic bag-of-words hashing embedder — shared words → higher cosine."""

    DIM = 64

    async def embed(self, texts: list[str]) -> list[list[float]]:
        out: list[list[float]] = []
        for text in texts:
            vec = [0.0] * self.DIM
            for tok in text.lower().split():
                h = int(hashlib.md5(tok.encode()).hexdigest(), 16) % self.DIM
                vec[h] += 1.0
            out.append(vec)
        return out


class ScriptedLLM:
    """Returns canned replies in order; records the prompts it was handed. When
    its script is exhausted it keeps returning the default suggestion JSON."""

    def __init__(self, replies: list[LLMReply]):
        self.replies = list(replies)
        self.seen: list[list[dict]] = []

    async def chat(self, messages: list[dict], tools: list[dict]) -> LLMReply:
        self.seen.append(messages)
        return self.replies.pop(0) if self.replies else LLMReply(content=_LLM_JSON)


@pytest.fixture(autouse=True)
def ai_stub():
    """Install fake LLM + embedder for every test; expose them for inspection /
    swapping (``ai_stub['llm'] = ScriptedLLM([...])``)."""
    state = {"llm": ScriptedLLM([]), "embedder": FakeEmbedder()}
    app.dependency_overrides[get_llm] = lambda: state["llm"]
    app.dependency_overrides[get_embedder] = lambda: state["embedder"]
    yield state
    app.dependency_overrides.pop(get_llm, None)
    app.dependency_overrides.pop(get_embedder, None)


# ── Setup helpers ─────────────────────────────────────────────────────────────


async def _new_failing_ncr(client, qe_token, pid, pour_id, ref, observed=27.0):
    """Cast a fresh sample + record a failing test → return its auto-raised NCR id."""
    sample_id = (
        await _cast_sample(client, qe_token, pid, pour_id, sample_reference=ref)
    ).json()["sample_id"]
    test = (
        await _record_test(client, qe_token, pid, sample_id, observed_strength_mpa=observed)
    ).json()
    return test["ncr_id"]


async def _close_with_resolution(client, qe_token, pid, ncr_id, root_cause):
    """Drive an OPEN NCR through review → resolved → CLOSED (the RAG corpus)."""
    await _patch_ncr(client, qe_token, pid, ncr_id, status="UNDER_REVIEW")
    await _patch_ncr(client, qe_token, pid, ncr_id, root_cause=root_cause)
    action = (
        await _add_action(
            client, qe_token, pid, ncr_id,
            action_description="Re-calibrate batching plant and re-pour the slab",
        )
    ).json()
    await client.patch(
        f"{API}/projects/{pid}/ncrs/{ncr_id}/corrective-actions/{action['action_id']}",
        json={"status": "COMPLETED"},
        headers=bearer(qe_token),
    )
    await _patch_ncr(client, qe_token, pid, ncr_id, status="CLOSED")


async def _project_with_corpus(client, db_session):
    """(contractor_token, qe_token, pid, pour_id, new_ncr_id) — one CLOSED NCR in
    the corpus plus a fresh OPEN NCR awaiting a suggestion."""
    contractor_token, qe_token, pid, pour_id = await _qe_pour(client, db_session)
    past = await _new_failing_ncr(client, qe_token, pid, pour_id, "CS-PAST")
    await _close_with_resolution(
        client, qe_token, pid, past,
        "Low cement content; plant batching calibration drift.",
    )
    new_ncr = await _new_failing_ncr(client, qe_token, pid, pour_id, "CS-NEW")
    return contractor_token, qe_token, pid, pour_id, new_ncr


def _gen(client, token, pid, ncr_id):
    return client.post(
        f"{API}/projects/{pid}/ncrs/{ncr_id}/ai-suggestion", headers=bearer(token)
    )


class TestGenerate:
    async def test_generate_is_grounded_in_past_closed_ncr(self, client, db_session):
        _, qe_token, pid, _, new_ncr = await _project_with_corpus(client, db_session)
        resp = await _gen(client, qe_token, pid, new_ncr)
        assert resp.status_code == 200, resp.text
        body = resp.json()

        assert body["root_cause_text"].startswith("Low cement content")
        assert len(body["corrective_actions"]) == 2
        assert body["confidence_level"] == "HIGH"
        assert body["ndt_recommended"] is True
        # The retrieved context is the past CLOSED NCR, with its resolution.
        assert len(body["retrieved"]) == 1
        chunk = body["retrieved"][0]
        assert chunk["root_cause"].startswith("Low cement content")
        assert chunk["corrective_actions"]
        assert 0.0 <= chunk["similarity"] <= 1.0

    async def test_generate_threads_corpus_into_the_prompt(self, client, db_session, ai_stub):
        _, qe_token, pid, _, new_ncr = await _project_with_corpus(client, db_session)
        resp = await _gen(client, qe_token, pid, new_ncr)
        assert resp.status_code == 200, resp.text
        # The user prompt the LLM saw must include the retrieved resolved case.
        user_msg = ai_stub["llm"].seen[0][-1]["content"]
        assert "SIMILAR PAST NCRs" in user_msg
        assert "Low cement content" in user_msg

    async def test_cold_start_without_corpus_is_low_confidence(self, client, db_session):
        # A project whose only NCR is the one we're asking about → no corpus.
        _, qe_token, pid, pour_id = await _qe_pour(client, db_session)
        ncr_id = await _new_failing_ncr(client, qe_token, pid, pour_id, "CS-ONLY")
        resp = await _gen(client, qe_token, pid, ncr_id)
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["retrieved"] == []
        assert body["confidence_level"] == "LOW"

    async def test_critical_failure_forces_ndt_even_if_model_declines(
        self, client, db_session, ai_stub
    ):
        _, qe_token, pid, pour_id = await _qe_pour(client, db_session)
        # M30 required 30.0; observed 20.0 < 85% → CRITICAL_FAILURE.
        ncr_id = await _new_failing_ncr(
            client, qe_token, pid, pour_id, "CS-CRIT", observed=20.0
        )
        ai_stub["llm"] = ScriptedLLM([
            LLMReply(content='{"root_cause": "x", "corrective_actions": [], "ndt_recommended": false}')
        ])
        resp = await _gen(client, qe_token, pid, ncr_id)
        assert resp.status_code == 200, resp.text
        assert resp.json()["ndt_recommended"] is True

    async def test_regenerate_replaces_previous_suggestion(
        self, client, db_session, ai_stub
    ):
        _, qe_token, pid, _, new_ncr = await _project_with_corpus(client, db_session)
        first = (await _gen(client, qe_token, pid, new_ncr)).json()
        ai_stub["llm"] = ScriptedLLM([
            LLMReply(content='{"root_cause": "Different cause", "corrective_actions": ["Only one"], "confidence": "MEDIUM"}')
        ])
        second = (await _gen(client, qe_token, pid, new_ncr)).json()
        assert second["suggestion_id"] == first["suggestion_id"]  # replaced, not added
        assert second["root_cause_text"] == "Different cause"
        assert second["corrective_actions"] == ["Only one"]


class TestReadAndRBAC:
    async def test_get_returns_persisted_suggestion(self, client, db_session):
        contractor_token, qe_token, pid, _, new_ncr = await _project_with_corpus(
            client, db_session
        )
        await _gen(client, qe_token, pid, new_ncr)
        # Any project viewer (here the contractor) can read it.
        resp = await client.get(
            f"{API}/projects/{pid}/ncrs/{new_ncr}/ai-suggestion",
            headers=bearer(contractor_token),
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["root_cause_text"].startswith("Low cement content")

    async def test_get_before_generate_is_404(self, client, db_session):
        _, qe_token, pid, _, new_ncr = await _project_with_corpus(client, db_session)
        resp = await client.get(
            f"{API}/projects/{pid}/ncrs/{new_ncr}/ai-suggestion",
            headers=bearer(qe_token),
        )
        assert resp.status_code == 404

    async def test_non_qe_cannot_generate(self, client, db_session):
        contractor_token, qe_token, pid, _, new_ncr = await _project_with_corpus(
            client, db_session
        )
        resp = await _gen(client, contractor_token, pid, new_ncr)
        assert resp.status_code == 403

    async def test_generate_on_unknown_ncr_is_404(self, client, db_session):
        _, qe_token, pid, _, _ = await _project_with_corpus(client, db_session)
        resp = await _gen(client, qe_token, pid, 999999)
        assert resp.status_code == 404


class TestApply:
    async def test_apply_copies_root_cause_and_creates_actions(self, client, db_session):
        _, qe_token, pid, _, new_ncr = await _project_with_corpus(client, db_session)
        await _gen(client, qe_token, pid, new_ncr)

        resp = await client.post(
            f"{API}/projects/{pid}/ncrs/{new_ncr}/ai-suggestion/apply",
            headers=bearer(qe_token),
        )
        assert resp.status_code == 200, resp.text
        ncr = resp.json()
        assert ncr["root_cause"].startswith("Low cement content")
        assert ncr["status"] == "UNDER_REVIEW"  # OPEN advanced on apply
        assert len(ncr["corrective_actions"]) == 2
        descriptions = [a["action_description"] for a in ncr["corrective_actions"]]
        assert any("Re-calibrate" in d for d in descriptions)

    async def test_apply_twice_does_not_duplicate_actions(self, client, db_session):
        _, qe_token, pid, _, new_ncr = await _project_with_corpus(client, db_session)
        await _gen(client, qe_token, pid, new_ncr)
        first = (
            await client.post(
                f"{API}/projects/{pid}/ncrs/{new_ncr}/ai-suggestion/apply",
                headers=bearer(qe_token),
            )
        ).json()
        again = (
            await client.post(
                f"{API}/projects/{pid}/ncrs/{new_ncr}/ai-suggestion/apply",
                headers=bearer(qe_token),
            )
        ).json()
        # Re-applying the same suggestion must not append duplicate rows.
        assert len(first["corrective_actions"]) == 2
        assert len(again["corrective_actions"]) == 2

    async def test_apply_can_skip_corrective_actions(self, client, db_session):
        _, qe_token, pid, _, new_ncr = await _project_with_corpus(client, db_session)
        await _gen(client, qe_token, pid, new_ncr)
        resp = await client.post(
            f"{API}/projects/{pid}/ncrs/{new_ncr}/ai-suggestion/apply",
            json={"apply_root_cause": True, "apply_corrective_actions": False},
            headers=bearer(qe_token),
        )
        assert resp.status_code == 200, resp.text
        ncr = resp.json()
        assert ncr["root_cause"].startswith("Low cement content")
        assert ncr["corrective_actions"] == []

    async def test_non_qe_cannot_apply(self, client, db_session):
        contractor_token, qe_token, pid, _, new_ncr = await _project_with_corpus(
            client, db_session
        )
        await _gen(client, qe_token, pid, new_ncr)
        resp = await client.post(
            f"{API}/projects/{pid}/ncrs/{new_ncr}/ai-suggestion/apply",
            headers=bearer(contractor_token),
        )
        assert resp.status_code == 403

    async def test_apply_without_suggestion_is_404(self, client, db_session):
        _, qe_token, pid, _, new_ncr = await _project_with_corpus(client, db_session)
        resp = await client.post(
            f"{API}/projects/{pid}/ncrs/{new_ncr}/ai-suggestion/apply",
            headers=bearer(qe_token),
        )
        assert resp.status_code == 404
