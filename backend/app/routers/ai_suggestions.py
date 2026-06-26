"""ai_suggestions.py router — Phase 9 AISuggestion / RAG, hung off an NCR.

A Quality Engineer asks the assistant to suggest a root cause and corrective
actions for a failing NCR; the suggestion is grounded in similar past CLOSED
NCRs and stored for audit. Any project viewer can read the latest suggestion.
Applying it (copying the root cause + creating corrective actions) is the QE's
human-in-the-loop step. The LLM and embedder are injected via dependencies so
tests stub them deterministically.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.embeddings import Embedder, get_embedder
from app.ai.llm import LLMClient, get_llm
from app.core.dependencies import get_current_user
from app.core.exceptions import PermissionDeniedError
from app.core.project_access import require_project
from app.database.session import get_db
from app.models.auth import User, UserRole
from app.models.master import Project
from app.schemas.ai_suggestion import AISuggestionApply, AISuggestionResponse
from app.schemas.quality import NCRDetailResponse
from app.services.ai_suggestion_service import AISuggestionService

router = APIRouter(prefix="/projects", tags=["ai-suggestions"])


def _ensure_quality_engineer(user: User) -> None:
    if user.role != UserRole.QUALITY_ENGINEER:
        raise PermissionDeniedError(
            "Only a quality engineer can generate or apply AI suggestions"
        )


@router.get(
    "/{project_id}/ncrs/{ncr_id}/ai-suggestion",
    response_model=AISuggestionResponse,
)
async def get_ai_suggestion(
    ncr_id: int,
    project: Project = Depends(require_project),
    db: AsyncSession = Depends(get_db),
):
    # Read-only — no LLM / embedder needed.
    return await AISuggestionService(db).get(project, ncr_id)


@router.post(
    "/{project_id}/ncrs/{ncr_id}/ai-suggestion",
    response_model=AISuggestionResponse,
)
async def generate_ai_suggestion(
    ncr_id: int,
    project: Project = Depends(require_project),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    llm: LLMClient = Depends(get_llm),
    embedder: Embedder = Depends(get_embedder),
):
    _ensure_quality_engineer(current_user)
    return await AISuggestionService(db, llm, embedder).generate(
        project, ncr_id, current_user
    )


@router.post(
    "/{project_id}/ncrs/{ncr_id}/ai-suggestion/apply",
    response_model=NCRDetailResponse,
)
async def apply_ai_suggestion(
    ncr_id: int,
    data: AISuggestionApply = AISuggestionApply(),
    project: Project = Depends(require_project),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Applies a stored suggestion — no LLM / embedder needed.
    _ensure_quality_engineer(current_user)
    return await AISuggestionService(db).apply(project, ncr_id, data, current_user)
