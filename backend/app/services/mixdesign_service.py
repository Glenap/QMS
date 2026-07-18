"""mixdesign_service.py — business logic for mix designs.

Mix designs are **RMC-owned, QE-approved** (Phase 4A): the contractor names the
grades it wants from a supplier, the RMC submits one detailed mix design per grade
through a tokenised public link, and the project's quality engineer reviews each
(approve / reject-with-reason / in-progress) — recording the strength observed at
28 days. Only an APPROVED mix's grade may be poured (see PourService).
"""

import logging
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.date_rules import ensure_not_after
from app.core.email import send_mix_design_request_email
from app.core.exceptions import (
    EntityBlockedError,
    EntityNotApprovedError,
    FileTooLargeError,
    NotFoundError,
    PermissionDeniedError,
    UnsupportedFileTypeError,
)
from app.core.fallback_log import fallback_detail
from app.core.security import create_invitation_token
from app.core.storage import make_key, storage
from app.models.auth import User
from app.models.master import (
    Document,
    Grade,
    MixApprovalStatus,
    MixDesign,
    Project,
    Supplier,
    SupplierRequiredGrade,
)
from app.repositories.auth_repo import AuthRepository
from app.repositories.mixdesign_repo import MixDesignRepository
from app.schemas.master import (
    GradeResponse,
    MixDesignResponse,
    MixDesignReview,
    MixDesignSubmit,
    MixSubmissionView,
    RequiredGradeInfo,
)

logger = logging.getLogger(__name__)

_MIX_PDF_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg"}


async def _try_send_mix_request(**kwargs) -> None:
    """Best-effort mix-design request email — an SMTP failure must not fail the
    request. On failure we log the link so local dev still works."""
    token = kwargs.get("token")
    try:
        await send_mix_design_request_email(**kwargs)
    except Exception as exc:  # noqa: BLE001 — best-effort email
        link = f"{settings.FRONTEND_URL}/external/mix-design?token={token}"
        logger.warning(
            "Mix-design request email to %s failed (%s). Link: %s",
            kwargs.get("supplier_email"),
            exc,
            fallback_detail(link),
        )


class MixDesignService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = MixDesignRepository(session)
        self.auth = AuthRepository(session)

    # ── Listing ──────────────────────────────────────────────────────────────

    async def list_for_project(self, project: Project) -> list[MixDesignResponse]:
        rows = await self.repo.list_by(
            MixDesign.project_id == project.project_id,
            order_by=MixDesign.created_at.desc(),
        )
        return [await self._to_response(md) for md in rows]

    async def list_for_supplier(
        self, project: Project, supplier_id: int
    ) -> list[MixDesignResponse]:
        rows = await self.repo.list_by(
            MixDesign.project_id == project.project_id,
            MixDesign.supplier_id == supplier_id,
            order_by=MixDesign.created_at.desc(),
        )
        return [await self._to_response(md) for md in rows]

    async def approved_grades(self, project: Project) -> list[GradeResponse]:
        """Grades that have at least one APPROVED mix design on the project —
        the only grades a pour may be raised for (see PourService)."""
        rows = await self.session.execute(
            select(Grade)
            .join(MixDesign, MixDesign.grade_id == Grade.grade_id)
            .where(
                MixDesign.project_id == project.project_id,
                MixDesign.approval_status == MixApprovalStatus.APPROVED,
            )
            .distinct()
            .order_by(Grade.min_strength_mpa)
        )
        return [GradeResponse.model_validate(g) for g in rows.scalars().all()]

    # ── Required grades (contractor names them; mints the submission link) ─────

    async def get_required_grades(
        self, project: Project, supplier_id: int
    ) -> list[RequiredGradeInfo]:
        await self._supplier_in_project(project, supplier_id)
        return await self._required_grades_info(supplier_id)

    async def set_required_grades(
        self, project: Project, supplier_id: int, grade_ids: list[int], user: User
    ) -> list[RequiredGradeInfo]:
        supplier = await self._supplier_in_project(project, supplier_id)
        if supplier.is_blocked:
            raise EntityBlockedError("supplier", supplier.block_reason)
        if supplier.approval_status not in ("NOT_REQUIRED", "ACCEPTED"):
            raise EntityNotApprovedError("supplier")

        wanted: set[int] = set()
        if grade_ids:
            res = await self.session.execute(
                select(Grade.grade_id).where(Grade.grade_id.in_(grade_ids))
            )
            wanted = set(res.scalars().all())
            if set(grade_ids) - wanted:
                raise NotFoundError("Grade")

        existing = await self._required_grade_ids(supplier_id)
        to_remove = existing - wanted
        if to_remove:
            await self.session.execute(
                delete(SupplierRequiredGrade).where(
                    SupplierRequiredGrade.supplier_id == supplier_id,
                    SupplierRequiredGrade.grade_id.in_(to_remove),
                )
            )
        for gid in wanted - existing:
            self.session.add(
                SupplierRequiredGrade(supplier_id=supplier_id, grade_id=gid)
            )

        if wanted and not supplier.mix_submission_token:
            supplier.mix_submission_token = create_invitation_token()
        if wanted:
            supplier.mix_submission_sent_at = datetime.now(UTC)
        await self.session.flush()

        if wanted and supplier.contact_email and supplier.mix_submission_token:
            org = await self.auth.get_org_by_id(supplier.contractor_org_id)
            names = await self._grade_names(wanted)
            await _try_send_mix_request(
                supplier_email=supplier.contact_email,
                supplier_name=supplier.supplier_name,
                project_name=project.project_name,
                grades=", ".join(names),
                registered_by=org.org_name if org else user.full_name,
                token=supplier.mix_submission_token,
            )
        return await self._required_grades_info(supplier_id)

    # ── Public submission (no auth — token only) ───────────────────────────────

    async def submission_view(self, token: str) -> MixSubmissionView:
        supplier = await self._by_mix_token(token)
        project = (
            await self.session.get(Project, supplier.project_id)
            if supplier.project_id
            else None
        )
        org = await self.auth.get_org_by_id(supplier.contractor_org_id)
        return MixSubmissionView(
            supplier_name=supplier.supplier_name,
            project_name=project.project_name if project else None,
            registered_by=org.org_name if org else None,
            required_grades=await self._required_grades_info(supplier.supplier_id),
        )

    async def submit(
        self,
        token: str,
        data: MixDesignSubmit,
        *,
        pdf_filename: str,
        pdf_content: bytes,
        pdf_content_type: str | None,
    ) -> MixDesignResponse:
        supplier = await self._by_mix_token(token)
        if data.grade_id not in await self._required_grade_ids(supplier.supplier_id):
            raise PermissionDeniedError(
                "This grade wasn't requested for your plant"
            )
        if not supplier.project_id:
            raise NotFoundError("Project")
        project = await self.session.get(Project, supplier.project_id)
        if project:
            ensure_not_after(
                project.start_date, data.trial_mix_date,
                earlier_label="project start date", later_label="trial mix date",
            )

        document_id = await self._store_mix_pdf(
            supplier.project_id, data, pdf_filename, pdf_content, pdf_content_type
        )

        fields = data.model_dump(exclude={"grade_id"})
        md = await self.repo.get_by(
            MixDesign.supplier_id == supplier.supplier_id,
            MixDesign.grade_id == data.grade_id,
        )
        if md is None:
            md = await self.repo.add(
                MixDesign(
                    supplier_id=supplier.supplier_id,
                    grade_id=data.grade_id,
                    project_id=supplier.project_id,
                    approval_status=MixApprovalStatus.PENDING,
                    document_id=document_id,
                    **fields,
                )
            )
        else:
            for key, value in fields.items():
                setattr(md, key, value)
            md.document_id = document_id
            # A resubmission goes back to PENDING and clears the prior review.
            md.approval_status = MixApprovalStatus.PENDING
            md.rejection_reason = None
            md.observed_28day_strength_mpa = None
            md.approval_date = None
            md.approved_by = None
            await self.session.flush()
        return await self._to_response(md)

    async def _store_mix_pdf(
        self,
        project_id: int,
        data: MixDesignSubmit,
        filename: str,
        content: bytes,
        content_type: str | None,
    ) -> int:
        """Persist the mandatory mix-design PDF as a PENDING project document."""
        ext = Path(filename).suffix.lower()
        if ext not in _MIX_PDF_EXTENSIONS:
            raise UnsupportedFileTypeError(ext or filename)
        if len(content) > settings.MAX_UPLOAD_BYTES:
            raise FileTooLargeError(settings.MAX_UPLOAD_BYTES)
        key = make_key(project_id, filename)
        storage.save(key, content)
        doc = Document(
            project_id=project_id,
            document_type="MIX_DESIGN",
            title=f"Mix design {data.mix_design_ref or ''}".strip(),
            original_filename=filename,
            stored_key=key,
            content_type=content_type,
            size_bytes=len(content),
            uploaded_by=None,
        )
        self.session.add(doc)
        await self.session.flush()
        return doc.document_id

    # ── QE review ──────────────────────────────────────────────────────────────

    async def review(
        self, project: Project, mix_design_id: int, data: MixDesignReview, user: User
    ) -> MixDesignResponse:
        md = await self.session.get(MixDesign, mix_design_id)
        if not md or md.project_id != project.project_id:
            raise NotFoundError("Mix design")

        md.approval_status = data.approval_status
        md.rejection_reason = (
            data.rejection_reason
            if data.approval_status == MixApprovalStatus.REJECTED
            else None
        )
        if data.observed_28day_strength_mpa is not None:
            md.observed_28day_strength_mpa = data.observed_28day_strength_mpa
        if data.approval_status == MixApprovalStatus.APPROVED:
            md.approval_date = datetime.now(UTC).date()
            md.approved_by = user.user_id
        else:
            md.approval_date = None
            md.approved_by = None
        await self.session.flush()
        return await self._to_response(md)

    # ── Internals ──────────────────────────────────────────────────────────────

    async def _supplier_in_project(
        self, project: Project, supplier_id: int
    ) -> Supplier:
        supplier = await self.session.get(Supplier, supplier_id)
        if not supplier or supplier.project_id != project.project_id:
            raise NotFoundError("Supplier")
        return supplier

    async def _by_mix_token(self, token: str) -> Supplier:
        res = await self.session.execute(
            select(Supplier).where(Supplier.mix_submission_token == token)
        )
        supplier = res.scalar_one_or_none()
        if not supplier:
            raise NotFoundError("Mix design submission")
        # Blocking previously gated only the authenticated side, so a blocked RMC
        # kept submitting through the token it already held — overwriting its
        # existing mix designs and resetting the QE's review to PENDING.
        if supplier.is_blocked:
            raise EntityBlockedError("supplier", supplier.block_reason)
        return supplier

    async def _required_grade_ids(self, supplier_id: int) -> set[int]:
        res = await self.session.execute(
            select(SupplierRequiredGrade.grade_id).where(
                SupplierRequiredGrade.supplier_id == supplier_id
            )
        )
        return set(res.scalars().all())

    async def _grade_names(self, grade_ids: set[int]) -> list[str]:
        res = await self.session.execute(
            select(Grade.grade_name)
            .where(Grade.grade_id.in_(grade_ids))
            .order_by(Grade.min_strength_mpa)
        )
        return list(res.scalars().all())

    async def _required_grades_info(
        self, supplier_id: int
    ) -> list[RequiredGradeInfo]:
        res = await self.session.execute(
            select(SupplierRequiredGrade.grade_id, Grade.grade_name)
            .join(Grade, Grade.grade_id == SupplierRequiredGrade.grade_id)
            .where(SupplierRequiredGrade.supplier_id == supplier_id)
            .order_by(Grade.min_strength_mpa)
        )
        rows = res.all()
        mixes = await self.session.execute(
            select(
                MixDesign.grade_id,
                MixDesign.mix_design_id,
                MixDesign.approval_status,
            ).where(MixDesign.supplier_id == supplier_id)
        )
        mix_by_grade = {g: (mid, status) for g, mid, status in mixes.all()}
        out: list[RequiredGradeInfo] = []
        for gid, gname in rows:
            mid, status = mix_by_grade.get(gid, (None, None))
            out.append(
                RequiredGradeInfo(
                    grade_id=gid,
                    grade_name=gname,
                    mix_design_id=mid,
                    approval_status=status,
                )
            )
        return out

    async def _to_response(self, md: MixDesign) -> MixDesignResponse:
        supplier = await self.repo.get_supplier(md.supplier_id)
        grade = await self.repo.get_grade(md.grade_id)
        resp = MixDesignResponse.model_validate(md)
        resp.supplier_name = supplier.supplier_name if supplier else None
        resp.grade_name = grade.grade_name if grade else None
        return resp
