"""chatbot.py router — the AI analyst agent at /projects/{id}/chat.

A project viewer asks a natural-language question; the agent answers it by
calling the read-only analytics / traceability / NCR tools (all project-scoped).
The LLM client is injected via ``get_llm`` so tests stub it deterministically.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.agent import run_agent
from app.ai.llm import LLMClient, get_llm
from app.core.project_access import require_project
from app.database.session import get_db
from app.models.master import Project
from app.schemas.chat import ChatRequest, ChatResponse

router = APIRouter(prefix="/projects", tags=["chatbot"])


@router.post("/{project_id}/chat", response_model=ChatResponse)
async def chat(
    data: ChatRequest,
    project: Project = Depends(require_project),
    db: AsyncSession = Depends(get_db),
    llm: LLMClient = Depends(get_llm),
):
    result = await run_agent(db, project, data.question, llm, history=data.history)
    return ChatResponse(
        answer=result.answer,
        tools_used=result.tools_used,
        chart=result.chart,
        clarification=result.clarification,
    )
