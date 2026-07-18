"""ai_suggestion_service.py — Phase 9: RAG-backed root-cause / corrective-action
suggestions for a failing NCR, with a human-in-the-loop apply step.

Pipeline (all project-scoped):

  load the failing NCR ─▶ retrieve the most similar PAST CLOSED NCRs (cosine over
  cached embeddings) ─▶ prompt the LLM, grounded in those resolved cases ─▶ parse
  its JSON answer ─▶ persist an ``AISuggestion`` (root cause + actions + the
  retrieved cases, for audit).

A Quality Engineer reviews the suggestion and may *apply* it: the root cause is
copied onto the NCR and each suggested action becomes a real corrective-action
row (reusing the Phase-5 lifecycle). The LLM and embedder are injected so tests
run deterministically without a model. Similarity is computed in Python over a
``double precision[]`` cache — no pgvector; the retrieval is swappable later.
"""

from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.embeddings import Embedder, cosine_similarity
from app.ai.llm import LLMClient
from app.ai.rag import (
    SUGGESTION_SYSTEM_PROMPT,
    NCRDoc,
    Suggestion,
    build_suggestion_prompt,
    failure_text,
    parse_suggestion,
    rank_by_similarity,
    resolved_text,
)
from app.config import settings
from app.core.exceptions import NCRStateError, NotFoundError
from app.models.auth import User
from app.models.master import Component, Floor, Grade, Project, Tower
from app.models.quality import (
    NCR,
    AISuggestion,
    ConfidenceLevel,
    CorrectiveAction,
    CubeTest,
    NCRStatus,
    ResultStatus,
)
from app.models.transaction import Pour
from app.repositories.ai_suggestion_repo import (
    AISuggestionRepository,
    NCREmbeddingRepository,
)
from app.repositories.cube_repo import CorrectiveActionRepository, NCRRepository
from app.schemas.ai_suggestion import (
    AISuggestionApply,
    AISuggestionResponse,
    RetrievedNCR,
)
from app.schemas.quality import NCRDetailResponse
from app.services.ncr_service import NCRService


def _embed_model_name(embedder: Embedder | None) -> str:
    """The name the cached vectors are stamped with, and validated against.

    It must track the embedder actually in use. Hardcoding OLLAMA_EMBED_MODEL
    made the stamp a constant, so a cache written under one provider stayed
    "valid" after switching to another: mismatched-dimension vectors then score
    0.0 in cosine_similarity, which still passes RAG_MIN_SIMILARITY=0.0, and the
    LLM gets grounded in arbitrary NCRs presented as similar cases — silently,
    with a 200.
    """
    # Both concrete embedders carry .model; a test fake may not, so fall back to
    # the configured provider's model name.
    name = getattr(embedder, "model", None)
    if isinstance(name, str) and name:
        return name
    return (
        settings.EMBED_MODEL
        if settings.AI_PROVIDER == "openai"
        else settings.OLLAMA_EMBED_MODEL
    )


class AISuggestionService:
    def __init__(
        self,
        session: AsyncSession,
        llm: LLMClient | None = None,
        embedder: Embedder | None = None,
    ):
        # llm + embedder are only needed by generate(); the read / apply paths
        # construct the service without them.
        self.session = session
        self.llm = llm
        self.embedder = embedder
        self.ncrs = NCRRepository(session)
        self.actions = CorrectiveActionRepository(session)
        self.suggestions = AISuggestionRepository(session)
        self.embeddings = NCREmbeddingRepository(session)
        self.embed_model = _embed_model_name(embedder)

    # ── Public API ───────────────────────────────────────────────────────────

    async def generate(
        self, project: Project, ncr_id: int, user: User
    ) -> AISuggestionResponse:
        ncr = await self._require(project, ncr_id)
        target = await self._ncr_doc(ncr)

        neighbours = await self._retrieve(project, ncr_id, target)
        parsed = await self._ask_llm(target, neighbours)
        # A model can over-claim on a cold corpus — ground confidence in retrieval.
        confidence = parsed.confidence if neighbours else ConfidenceLevel.LOW

        suggestion = await self._persist(ncr, parsed, confidence, neighbours)
        return self._response(suggestion)

    async def get(self, project: Project, ncr_id: int) -> AISuggestionResponse:
        ncr = await self._require(project, ncr_id)
        suggestion = await self.suggestions.get_for_ncr(ncr.ncr_id)
        if not suggestion:
            raise NotFoundError("AI suggestion")
        return self._response(suggestion)

    async def apply(
        self, project: Project, ncr_id: int, data: AISuggestionApply, user: User
    ) -> NCRDetailResponse:
        ncr = await self._require(project, ncr_id)
        suggestion = await self.suggestions.get_for_ncr(ncr.ncr_id)
        if not suggestion:
            raise NotFoundError("AI suggestion")
        if ncr.status == NCRStatus.CLOSED:
            raise NCRStateError("Reopen this NCR before applying an AI suggestion")

        if data.apply_root_cause and suggestion.root_cause_text:
            ncr.root_cause = suggestion.root_cause_text

        if data.apply_corrective_actions:
            # Idempotent: skip any suggested action already on the NCR so a
            # re-apply (e.g. after a regenerate) doesn't duplicate rows.
            existing = {
                a.action_description.strip()
                for a in await self.actions.list_for_ncr(ncr.ncr_id)
            }
            for desc in self._suggested_actions(suggestion):
                if desc in existing:
                    continue
                existing.add(desc)
                await self.actions.add(
                    CorrectiveAction(ncr_id=ncr.ncr_id, action_description=desc)
                )

        # A human is now acting on it — move OPEN into review.
        if ncr.status == NCRStatus.OPEN:
            ncr.status = NCRStatus.UNDER_REVIEW
            ncr.closed_at = None

        await self.session.flush()
        return await NCRService(self.session).get_ncr(project, ncr_id)

    # ── Retrieval ────────────────────────────────────────────────────────────

    async def _retrieve(
        self, project: Project, ncr_id: int, target: NCRDoc
    ) -> list[tuple[NCRDoc, float]]:
        closed = await self.ncrs.list_resolved_for_project(
            project.project_id, exclude_ncr_id=ncr_id
        )
        if not closed:
            return []

        docs = [await self._ncr_doc(c) for c in closed]
        texts = [resolved_text(d) for d in docs]
        vectors = await self._corpus_vectors(closed, texts)

        query_vec = await self._embed_one(failure_text(target))
        candidates = [
            (doc, vec) for doc, vec in zip(docs, vectors, strict=True) if vec
        ]
        return rank_by_similarity(
            query_vec,
            candidates,
            top_k=settings.RAG_TOP_K,
            min_similarity=settings.RAG_MIN_SIMILARITY,
            cosine=cosine_similarity,
        )

    async def _corpus_vectors(
        self, closed: list[NCR], texts: list[str]
    ) -> list[list[float]]:
        """Cached vector per closed NCR, embedding the cache misses in one batch."""
        cache = await self.embeddings.get_for_ncrs([c.ncr_id for c in closed])
        vectors: list[list[float]] = [[] for _ in closed]
        misses: list[tuple[int, NCR, str]] = []
        for i, (c, text) in enumerate(zip(closed, texts, strict=True)):
            row = cache.get(c.ncr_id)
            if row is not None and row.source_text == text and row.model == self.embed_model:
                vectors[i] = list(row.vector)
            else:
                misses.append((i, c, text))

        if misses:
            new_vecs = await self.embedder.embed([t for _, _, t in misses])
            for (i, c, text), vec in zip(misses, new_vecs, strict=True):
                await self.embeddings.upsert(
                    c.ncr_id, vector=vec, source_text=text, model=self.embed_model
                )
                vectors[i] = vec
        return vectors

    async def _embed_one(self, text: str) -> list[float]:
        vecs = await self.embedder.embed([text])
        return vecs[0] if vecs else []

    # ── LLM ──────────────────────────────────────────────────────────────────

    async def _ask_llm(
        self, target: NCRDoc, neighbours: list[tuple[NCRDoc, float]]
    ) -> Suggestion:
        prompt = build_suggestion_prompt(target, neighbours)
        reply = await self.llm.chat(
            [
                {"role": "system", "content": SUGGESTION_SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            [],
        )
        critical = target.result_status == ResultStatus.CRITICAL_FAILURE.value
        return parse_suggestion(reply.content, default_ndt=critical)

    # ── Persistence ──────────────────────────────────────────────────────────

    async def _persist(
        self,
        ncr: NCR,
        parsed: Suggestion,
        confidence: ConfidenceLevel,
        neighbours: list[tuple[NCRDoc, float]],
    ) -> AISuggestion:
        actions_json = {"actions": parsed.corrective_actions}
        chunks_json = {"chunks": [self._chunk(doc, score) for doc, score in neighbours]}

        existing = await self.suggestions.get_for_ncr(ncr.ncr_id)
        if existing is not None:
            existing.test_id = ncr.test_id
            existing.root_cause_text = parsed.root_cause
            existing.corrective_actions_json = actions_json
            existing.retrieved_chunks_json = chunks_json
            existing.confidence_level = confidence
            existing.ndt_recommended = parsed.ndt_recommended
            existing.generated_at = datetime.now(UTC)
            await self.session.flush()
            return existing

        return await self.suggestions.add(
            AISuggestion(
                ncr_id=ncr.ncr_id,
                test_id=ncr.test_id,
                root_cause_text=parsed.root_cause,
                corrective_actions_json=actions_json,
                retrieved_chunks_json=chunks_json,
                confidence_level=confidence,
                ndt_recommended=parsed.ndt_recommended,
            )
        )

    # ── Helpers ──────────────────────────────────────────────────────────────

    async def _require(self, project: Project, ncr_id: int) -> NCR:
        ncr = await self.ncrs.get_in_project(ncr_id, project.project_id)
        if not ncr:
            raise NotFoundError("NCR")
        return ncr

    async def _ncr_doc(self, ncr: NCR) -> NCRDoc:
        """Denormalise one NCR into the text-bearing fields RAG needs. The corpus
        is small, so per-NCR loads here are fine (no batch path needed)."""
        test = await self.session.get(CubeTest, ncr.test_id)
        pour = await self.session.get(Pour, ncr.pour_id)
        tower = await self.session.get(Tower, pour.tower_id) if pour else None
        floor = await self.session.get(Floor, pour.floor_id) if pour else None
        component = await self.session.get(Component, pour.component_id) if pour else None
        grade = await self.session.get(Grade, pour.grade_id) if pour else None
        actions = await self.actions.list_for_ncr(ncr.ncr_id)
        return NCRDoc(
            ncr_id=ncr.ncr_id,
            ncr_number=ncr.ncr_number,
            grade_name=grade.grade_name if grade else None,
            result_status=test.result_status.value if test else None,
            observed_strength_mpa=float(test.observed_strength_mpa) if test else None,
            required_strength_mpa=float(test.required_strength_mpa) if test else None,
            test_age_days=test.test_age_days if test else None,
            tower_name=tower.tower_name if tower else None,
            floor_label=floor.floor_label if floor else None,
            component_type=component.component_type.value if component else None,
            root_cause=ncr.root_cause,
            corrective_actions=[a.action_description for a in actions],
        )

    @staticmethod
    def _chunk(doc: NCRDoc, score: float) -> dict:
        return {
            "ncr_id": doc.ncr_id,
            "ncr_number": doc.ncr_number,
            "similarity": round(score, 4),
            "grade_name": doc.grade_name,
            "result_status": doc.result_status,
            "root_cause": doc.root_cause,
            "corrective_actions": doc.corrective_actions,
        }

    @staticmethod
    def _suggested_actions(suggestion: AISuggestion) -> list[str]:
        actions = (suggestion.corrective_actions_json or {}).get("actions", [])
        return [str(a).strip() for a in actions if str(a).strip()]

    def _response(self, suggestion: AISuggestion) -> AISuggestionResponse:
        retrieved = [
            RetrievedNCR(**chunk)
            for chunk in (suggestion.retrieved_chunks_json or {}).get("chunks", [])
        ]
        return AISuggestionResponse(
            suggestion_id=suggestion.suggestion_id,
            ncr_id=suggestion.ncr_id,
            test_id=suggestion.test_id,
            root_cause_text=suggestion.root_cause_text,
            corrective_actions=self._suggested_actions(suggestion),
            confidence_level=suggestion.confidence_level,
            ndt_recommended=suggestion.ndt_recommended,
            retrieved=retrieved,
            generated_at=suggestion.generated_at,
        )
