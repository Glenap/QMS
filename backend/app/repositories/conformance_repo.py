"""conformance_repo.py — DB access for conformance defect findings.

A finding is 1:1 with a conformance photo (``document_id`` unique); the service
upserts by document_id so re-classifying a photo replaces its finding.
"""

from app.models.quality import ConformanceFinding
from app.repositories.base_repo import BaseRepository


class ConformanceFindingRepository(BaseRepository[ConformanceFinding]):
    model = ConformanceFinding

    async def list_for_project(self, project_id: int) -> list[ConformanceFinding]:
        return await self.list_by(ConformanceFinding.project_id == project_id)

    async def get_for_document(self, document_id: int) -> ConformanceFinding | None:
        return await self.get_by(ConformanceFinding.document_id == document_id)
