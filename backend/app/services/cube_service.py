"""cube_service.py — business logic for cube samples, tests, and auto-NCRs.

Flow:

  QE casts a cube sample from a pour and dispatches it to a lab ──▶ the lab
  (passwordless, via a tokenised link) establishes the testing day and submits
  the 7/14/28-day strength reports ──▶ the quality engine grades each PASS /
  FAIL / CRITICAL_FAILURE ──▶ a failing **28-day** result auto-raises an NCR
  (open, awaiting the Phase 5 lifecycle). Earlier-age failures are recorded but
  raise nothing — the 28-day test is the IS 456 acceptance criterion.

Cube samples are scoped to a project through their pour; the repos join through
that chain. Responses carry denormalised display names (pour location, grade,
lab) so the cube-results table and NCR list render without extra lookups.
"""

import logging
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core import quality_engine
from app.core.date_rules import ensure_not_after
from app.core.email import send_lab_report_request_email
from app.core.exceptions import (
    EntityBlockedError,
    LabReportStateError,
    NotFoundError,
    UnsupportedFileTypeError,
)
from app.core.security import create_invitation_token
from app.core.storage import make_key, storage
from app.models.auth import User
from app.models.master import (
    Component,
    Document,
    Floor,
    Grade,
    GradeThreshold,
    Project,
    TestingLab,
    Tower,
)
from app.models.quality import NCR, CubeTest, NCRStatus, ResultStatus
from app.models.transaction import CubeSample, Pour
from app.repositories.auth_repo import AuthRepository
from app.repositories.cube_repo import (
    CubeSampleRepository,
    CubeTestRepository,
    NCRRepository,
)
from app.repositories.pour_repo import PourRepository
from app.schemas.lab_report import (
    ACCEPTANCE_AGE_DAYS,
    REPORT_AGES,
    LabReportLink,
    LabReportMilestone,
    LabReportResult,
    LabReportStart,
    LabReportSubmit,
    LabReportView,
)
from app.schemas.quality import (
    CubeSampleCreate,
    CubeSampleResponse,
    CubeTestResponse,
)
from app.services.alert_service import AlertService

logger = logging.getLogger(__name__)

# A failing test grades to one of these — the engine's non-passing outcomes.
_FAILING = (ResultStatus.FAIL, ResultStatus.CRITICAL_FAILURE)

# PDF is the expected lab report, but accept the common scan image types too.
_REPORT_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg"}


def _should_raise_ncr(result: ResultStatus, test_age_days: int) -> bool:
    """An NCR is auto-raised only for a failing **28-day** (acceptance) result.

    The 7/14-day reports are early-age indicators — a miss there is recorded and
    visible, but the formal non-conformance is the 28-day characteristic test."""
    return result in _FAILING and test_age_days >= ACCEPTANCE_AGE_DAYS


class CubeService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.samples = CubeSampleRepository(session)
        self.tests = CubeTestRepository(session)
        self.ncrs = NCRRepository(session)
        self.pours = PourRepository(session)
        self.auth = AuthRepository(session)

    # ── Samples ──────────────────────────────────────────────────────────────

    async def create_sample(
        self, project: Project, pour_id: int, data: CubeSampleCreate, user: User
    ) -> CubeSampleResponse:
        pour = await self.pours.get_in_project(pour_id, project.project_id)
        if not pour:
            raise NotFoundError("Pour")
        await self._validate_lab(data.lab_id, project.project_id)

        # Timeline: cubes are cast from the pour, then dispatched to the lab.
        ensure_not_after(
            pour.pour_date, data.cast_date,
            earlier_label="pour date", later_label="cast date",
        )
        ensure_not_after(
            data.cast_date, data.lab_dispatch_date,
            earlier_label="cast date", later_label="lab dispatch date",
        )
        ensure_not_after(
            data.lab_dispatch_date or data.cast_date, data.expected_result_date,
            earlier_label="lab dispatch date", later_label="expected result date",
        )

        sample = await self.samples.add(
            CubeSample(
                pour_id=pour.pour_id,
                cast_by=user.user_id,
                **data.model_dump(),
            )
        )
        # Dispatching to a lab with a contact email issues the report token and
        # emails the link so the lab can submit the 7/14/28-day reports.
        await self._issue_report_token(sample, project)
        return await self._sample_response(sample, pour=pour)

    async def list_samples_for_pour(
        self, project: Project, pour_id: int
    ) -> list[CubeSampleResponse]:
        pour = await self.pours.get_in_project(pour_id, project.project_id)
        if not pour:
            raise NotFoundError("Pour")
        samples = await self.samples.list_for_pour(pour_id)
        ncr_map = await self._ncr_map_for_samples([s.sample_id for s in samples])
        return [await self._sample_response(s, pour=pour, ncr_map=ncr_map) for s in samples]

    async def list_samples_for_project(
        self, project: Project
    ) -> list[CubeSampleResponse]:
        samples = await self.samples.list_for_project(project.project_id)
        ncr_map = await self._ncr_map_for_samples([s.sample_id for s in samples])
        return [await self._sample_response(s, ncr_map=ncr_map) for s in samples]

    # ── Lab report dispatch (authed QE side) ─────────────────────────────────

    async def resend_report_link(
        self, project: Project, sample_id: int, user: User
    ) -> CubeSampleResponse:
        """Re-email the lab its report link (the manual nudge for a due milestone).
        Issues a token if one was never created (e.g. lab assigned after casting)."""
        sample = await self.samples.get_in_project(sample_id, project.project_id)
        if not sample:
            raise NotFoundError("Cube sample")
        if not sample.lab_id:
            raise LabReportStateError("Assign a lab to this sample before sending a link")
        sent = await self._issue_report_token(sample, project, is_reminder=True)
        if not sent:
            raise LabReportStateError("This lab has no contact email to send to")
        return await self._sample_response(sample)

    async def get_report_link(
        self, project: Project, sample_id: int, user: User
    ) -> LabReportLink:
        """The lab's report URL, for the QE to copy/share. Mints a token if the
        sample doesn't have one yet (e.g. no lab email to auto-dispatch to)."""
        sample = await self.samples.get_in_project(sample_id, project.project_id)
        if not sample:
            raise NotFoundError("Cube sample")
        token = await self._ensure_report_token(sample)
        return LabReportLink(
            token=token,
            report_url=f"{settings.FRONTEND_URL}/external/lab-report?token={token}",
            sent=sample.report_token_sent_at is not None,
        )

    # ── Public lab report flow (no auth — token only) ────────────────────────

    async def get_report_view(self, token: str) -> LabReportView:
        sample = await self._sample_by_report_token(token)
        pour = await self.session.get(Pour, sample.pour_id)
        project = (
            await self.session.get(Project, pour.project_id) if pour else None
        )
        grade = await self.session.get(Grade, pour.grade_id) if pour else None
        lab = (
            await self.session.get(TestingLab, sample.lab_id)
            if sample.lab_id
            else None
        )
        tests = {t.test_age_days: t for t in await self.tests.list_for_sample(sample.sample_id)}

        milestones: list[LabReportMilestone] = []
        for age in REPORT_AGES:
            t = tests.get(age)
            due = (
                sample.testing_started_on + timedelta(days=age)
                if sample.testing_started_on
                else None
            )
            if t is not None:
                milestones.append(
                    LabReportMilestone(
                        test_age_days=age,
                        due_date=due,
                        submitted=True,
                        test_date=t.test_date,
                        observed_strength_mpa=float(t.observed_strength_mpa),
                        required_strength_mpa=float(t.required_strength_mpa),
                        result_status=t.result_status,
                        has_report_pdf=t.report_document_id is not None,
                    )
                )
            else:
                milestones.append(
                    LabReportMilestone(test_age_days=age, due_date=due, submitted=False)
                )

        return LabReportView(
            project_name=project.project_name if project else None,
            lab_name=lab.lab_name if lab else None,
            sample_reference=sample.sample_reference,
            grade_name=grade.grade_name if grade else None,
            grade_min_strength_mpa=grade.min_strength_mpa if grade else None,
            pour_reference=pour.pour_reference if pour else None,
            cast_date=sample.cast_date,
            no_of_cubes=sample.no_of_cubes,
            cube_received_on=sample.cube_received_on,
            testing_started_on=sample.testing_started_on,
            milestones=milestones,
        )

    async def start_testing(self, token: str, data: LabReportStart) -> LabReportView:
        """The lab establishes the testing day — anchors the milestone schedule."""
        sample = await self._sample_by_report_token(token)
        # Timeline: cubes are cast, received at the lab, then testing starts.
        ensure_not_after(
            sample.cast_date, data.cube_received_on,
            earlier_label="cast date", later_label="cube received date",
        )
        ensure_not_after(
            data.cube_received_on, data.testing_started_on,
            earlier_label="cube received date", later_label="testing start date",
        )
        ensure_not_after(
            sample.cast_date, data.testing_started_on,
            earlier_label="cast date", later_label="testing start date",
        )
        if data.cube_received_on is not None:
            sample.cube_received_on = data.cube_received_on
        sample.testing_started_on = data.testing_started_on
        await self.session.flush()
        return await self.get_report_view(token)

    async def submit_report(
        self,
        token: str,
        data: LabReportSubmit,
        *,
        pdf_filename: str | None = None,
        pdf_content: bytes | None = None,
        pdf_content_type: str | None = None,
    ) -> LabReportResult:
        sample = await self._sample_by_report_token(token)
        if data.test_age_days not in REPORT_AGES:
            raise LabReportStateError(
                f"Report age must be one of {', '.join(map(str, REPORT_AGES))} days"
            )
        if sample.testing_started_on is None:
            raise LabReportStateError(
                "Set the testing start date before submitting a report"
            )

        existing = {t.test_age_days for t in await self.tests.list_for_sample(sample.sample_id)}
        if data.test_age_days in existing:
            raise LabReportStateError(
                f"The {data.test_age_days}-day report has already been submitted"
            )

        pour = await self.session.get(Pour, sample.pour_id)
        if not pour:
            raise NotFoundError("Pour")
        grade = await self.session.get(Grade, pour.grade_id)
        threshold = await self._threshold_for(pour.grade_id, data.test_age_days)
        required = quality_engine.required_strength(
            grade.min_strength_mpa if grade else 0,
            data.test_age_days,
            threshold,
        )
        result = quality_engine.classify(data.observed_strength_mpa, required)
        # A reported test can't predate the day testing started.
        ensure_not_after(
            sample.testing_started_on, data.test_date,
            earlier_label="testing start date", later_label="test date",
        )
        test_date = data.test_date or (
            sample.testing_started_on + timedelta(days=data.test_age_days)
        )

        document_id = None
        if pdf_content:
            document_id = await self._store_report_pdf(
                pour.project_id,
                data.test_age_days,
                pdf_filename or "lab-report.pdf",
                pdf_content,
                pdf_content_type,
            )

        test = await self.tests.add(
            CubeTest(
                sample_id=sample.sample_id,
                lab_id=sample.lab_id,
                test_age_days=data.test_age_days,
                test_date=test_date,
                observed_strength_mpa=data.observed_strength_mpa,
                required_strength_mpa=required,
                result_status=result,
                tested_by=None,
                lab_report_reference=data.lab_report_reference,
                report_document_id=document_id,
            )
        )

        ncr_raised = False
        if _should_raise_ncr(result, data.test_age_days):
            await self._raise_ncr(test, pour)
            ncr_raised = True

        # IS-456/10262 alert for the QE + PM (individual/group/trend), independent
        # of the auto-NCR — a passing individual can still drift the group average.
        await AlertService(self.session).evaluate_on_test(test, pour)

        return LabReportResult(
            test_age_days=data.test_age_days,
            result_status=result,
            observed_strength_mpa=float(data.observed_strength_mpa),
            required_strength_mpa=float(required),
            ncr_raised=ncr_raised,
            message=self._report_message(data.test_age_days, result, ncr_raised),
        )

    # ── Internals ────────────────────────────────────────────────────────────

    @staticmethod
    def _report_message(age: int, result: ResultStatus, ncr_raised: bool) -> str:
        if ncr_raised:
            return (
                f"{age}-day report received — the result is below the required "
                "28-day strength, so a non-conformance has been raised."
            )
        if result == ResultStatus.PASS:
            return f"{age}-day report received — strength meets the requirement. Thank you."
        return (
            f"{age}-day report received. The early-age strength is below target; "
            "the 28-day result is the acceptance test."
        )

    async def _ensure_report_token(self, sample: CubeSample) -> str:
        """The sample's report token, minting one if absent (no email)."""
        if not sample.report_token:
            sample.report_token = create_invitation_token()
            await self.session.flush()
        return sample.report_token

    async def _issue_report_token(
        self, sample: CubeSample, project: Project, *, is_reminder: bool = False
    ) -> bool:
        """Ensure the sample has a report token and email the lab the link.
        Returns True if an email was attempted (lab present with a contact email)."""
        if not sample.lab_id:
            return False
        lab = await self.session.get(TestingLab, sample.lab_id)
        if not lab or not lab.contact_email:
            return False

        await self._ensure_report_token(sample)
        sample.report_token_sent_at = datetime.now(UTC)
        await self.session.flush()

        pour = await self.session.get(Pour, sample.pour_id)
        grade = await self.session.get(Grade, pour.grade_id) if pour else None
        org = await self.auth.get_org_by_id(lab.contractor_org_id)
        try:
            await send_lab_report_request_email(
                lab_email=lab.contact_email,
                lab_name=lab.lab_name,
                project_name=project.project_name,
                sample_reference=sample.sample_reference or f"Sample #{sample.sample_id}",
                grade=grade.grade_name if grade else "",
                registered_by=org.org_name if org else "",
                token=sample.report_token,
                is_reminder=is_reminder,
            )
        except Exception as exc:  # noqa: BLE001 — best-effort email
            link = f"{settings.FRONTEND_URL}/external/lab-report?token={sample.report_token}"
            logger.warning(
                "Lab report email to %s failed (%s). Link: %s",
                lab.contact_email, exc, link,
            )
        return True

    async def _store_report_pdf(
        self,
        project_id: int,
        age: int,
        filename: str,
        content: bytes,
        content_type: str | None,
    ) -> int:
        ext = Path(filename).suffix.lower()
        if ext not in _REPORT_EXTENSIONS:
            raise UnsupportedFileTypeError(ext or filename)
        if len(content) > settings.MAX_UPLOAD_BYTES:
            from app.core.exceptions import FileTooLargeError

            raise FileTooLargeError(settings.MAX_UPLOAD_BYTES)
        key = make_key(project_id, filename)
        storage.save(key, content)
        doc = Document(
            project_id=project_id,
            document_type="LAB_REPORT",
            title=f"{age}-day lab report",
            original_filename=filename,
            stored_key=key,
            content_type=content_type,
            size_bytes=len(content),
            uploaded_by=None,
        )
        self.session.add(doc)
        await self.session.flush()
        return doc.document_id

    async def _sample_by_report_token(self, token: str) -> CubeSample:
        sample = await self.samples.get_by(CubeSample.report_token == token)
        if not sample:
            raise NotFoundError("Report")
        return sample

    async def _validate_lab(self, lab_id: int | None, project_id: int) -> None:
        if lab_id is None:
            return
        lab = await self.session.get(TestingLab, lab_id)
        if not lab or lab.project_id != project_id:
            raise NotFoundError("Lab")
        if lab.is_blocked:
            raise EntityBlockedError("lab", lab.block_reason)

    async def _threshold_for(
        self, grade_id: int, test_age_days: int
    ) -> float | None:
        res = await self.session.execute(
            select(GradeThreshold.min_strength_mpa).where(
                GradeThreshold.grade_id == grade_id,
                GradeThreshold.test_age_days == test_age_days,
            )
        )
        return res.scalar_one_or_none()

    async def _raise_ncr(
        self, test: CubeTest, pour: Pour, user: User | None = None
    ) -> NCR:
        ncr = await self.ncrs.add(
            NCR(
                test_id=test.test_id,
                pour_id=pour.pour_id,
                status=NCRStatus.OPEN,
                raised_by=user.user_id if user else None,
            )
        )
        ncr.ncr_number = f"NCR-{date.today():%Y%m%d}-{ncr.ncr_id:04d}"
        await self.session.flush()
        return ncr

    async def _ncr_map_for_samples(self, sample_ids: list[int]) -> dict[int, NCR]:
        """{test_id: NCR} for every test belonging to the given samples."""
        if not sample_ids:
            return {}
        tests = await self.tests.list_for_samples(sample_ids)
        test_ids = [t.test_id for t in tests]
        if not test_ids:
            return {}
        res = await self.session.execute(select(NCR).where(NCR.test_id.in_(test_ids)))
        return {n.test_id: n for n in res.scalars().all()}

    async def _sample_response(
        self,
        sample: CubeSample,
        *,
        pour: Pour | None = None,
        ncr_map: dict[int, NCR] | None = None,
    ) -> CubeSampleResponse:
        if pour is None:
            pour = await self.session.get(Pour, sample.pour_id)
        tower = await self.session.get(Tower, pour.tower_id) if pour else None
        floor = await self.session.get(Floor, pour.floor_id) if pour else None
        component = await self.session.get(Component, pour.component_id) if pour else None
        grade = await self.session.get(Grade, pour.grade_id) if pour else None
        lab = await self.session.get(TestingLab, sample.lab_id) if sample.lab_id else None

        tests = await self.tests.list_for_sample(sample.sample_id)
        test_responses = [
            await self._test_response(
                t, ncr=ncr_map.get(t.test_id) if ncr_map is not None else None
            )
            for t in tests
        ]
        return CubeSampleResponse(
            sample_id=sample.sample_id,
            pour_id=sample.pour_id,
            sample_reference=sample.sample_reference,
            cast_date=sample.cast_date,
            no_of_cubes=sample.no_of_cubes,
            lab_id=sample.lab_id,
            lab_name=lab.lab_name if lab else None,
            lab_dispatch_date=sample.lab_dispatch_date,
            expected_result_date=sample.expected_result_date,
            lab_dispatch_notes=sample.lab_dispatch_notes,
            report_link_sent=sample.report_token_sent_at is not None,
            cube_received_on=sample.cube_received_on,
            testing_started_on=sample.testing_started_on,
            created_at=sample.created_at,
            pour_reference=pour.pour_reference if pour else None,
            tower_name=tower.tower_name if tower else None,
            floor_label=floor.floor_label if floor else None,
            component_type=component.component_type.value if component else None,
            grade_name=grade.grade_name if grade else None,
            grade_min_strength_mpa=grade.min_strength_mpa if grade else None,
            tests=test_responses,
        )

    async def _test_response(
        self, test: CubeTest, *, ncr: NCR | None = None
    ) -> CubeTestResponse:
        # NCRs only exist for failing 28-day results — only look one up when the
        # test could have raised one.
        if ncr is None and _should_raise_ncr(test.result_status, test.test_age_days):
            res = await self.session.execute(
                select(NCR).where(NCR.test_id == test.test_id)
            )
            ncr = res.scalar_one_or_none()
        lab = await self.session.get(TestingLab, test.lab_id) if test.lab_id else None
        return CubeTestResponse(
            test_id=test.test_id,
            sample_id=test.sample_id,
            test_age_days=test.test_age_days,
            test_date=test.test_date,
            observed_strength_mpa=test.observed_strength_mpa,
            required_strength_mpa=test.required_strength_mpa,
            result_status=test.result_status,
            lab_id=test.lab_id,
            lab_name=lab.lab_name if lab else None,
            lab_report_reference=test.lab_report_reference,
            report_document_id=test.report_document_id,
            submitted_by_lab=test.tested_by is None,
            ncr_id=ncr.ncr_id if ncr else None,
            ncr_number=ncr.ncr_number if ncr else None,
            created_at=test.created_at,
        )
