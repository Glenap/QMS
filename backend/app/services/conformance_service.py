"""conformance_service.py — defect findings for the Conformance Analyser.

Persists each inspector classification of a conformance photo. One finding per
photo: ``upsert`` updates the existing finding for a document or inserts a new
one (the defect taxonomy itself lives on the frontend — the backend just records
which defect + remediation the inspector chose).
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.models.auth import User
from app.models.master import Document, Project
from app.models.quality import ConformanceFinding
from app.repositories.conformance_repo import ConformanceFindingRepository
from app.schemas.conformance import ConformanceFindingResponse, ConformanceFindingUpsert


class ConformanceService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = ConformanceFindingRepository(session)

    async def list_for_project(self, project: Project) -> list[ConformanceFindingResponse]:
        rows = await self.repo.list_for_project(project.project_id)
        return [ConformanceFindingResponse.model_validate(r) for r in rows]

    async def upsert(
        self, project: Project, data: ConformanceFindingUpsert, user: User
    ) -> ConformanceFindingResponse:
        # The photo must be a document on this project.
        doc = await self.session.get(Document, data.document_id)
        if doc is None or doc.project_id != project.project_id:
            raise NotFoundError("Conformance photo")

        existing = await self.repo.get_for_document(data.document_id)
        if existing is not None:
            existing.phase = data.phase
            existing.defect_code = data.defect_code
            existing.defect_label = data.defect_label
            existing.severity = data.severity
            existing.remediation_choice = data.remediation_choice
            existing.notes = data.notes
            await self.session.flush()
            # onupdate recomputes updated_at server-side; refresh so reading it in
            # the response doesn't trigger a lazy load (MissingGreenlet) in async.
            await self.session.refresh(existing)
            return ConformanceFindingResponse.model_validate(existing)

        finding = await self.repo.add(
            ConformanceFinding(
                project_id=project.project_id,
                document_id=data.document_id,
                phase=data.phase,
                defect_code=data.defect_code,
                defect_label=data.defect_label,
                severity=data.severity,
                remediation_choice=data.remediation_choice,
                notes=data.notes,
                created_by=user.user_id,
            )
        )
        return ConformanceFindingResponse.model_validate(finding)

    async def delete(self, project: Project, finding_id: int) -> None:
        finding = await self.session.get(ConformanceFinding, finding_id)
        if finding is None or finding.project_id != project.project_id:
            raise NotFoundError("Conformance finding")
        await self.session.delete(finding)
        await self.session.flush()
