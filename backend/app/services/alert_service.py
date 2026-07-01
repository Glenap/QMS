"""alert_service.py — IS-456/10262 quality alerts for the QE + project manager.

On each 28-day (acceptance) cube result the service applies the IS 456 individual
and 4-sample moving-average criteria (via ``quality_engine``) and raises a graded
alert when strength drifts toward — or past — the acceptance limits. The alerts
feed an in-app bell/feed; a QE/PM can then email the RMC about the issue.
"""

from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import quality_engine
from app.core.exceptions import NotFoundError
from app.models.auth import User
from app.models.master import Grade, Project, Supplier
from app.models.quality import Alert, AlertLevel, AlertStatus, CubeTest
from app.models.transaction import CubeSample, Pour
from app.schemas.alert import AlertResponse
from app.schemas.lab_report import ACCEPTANCE_AGE_DAYS

_RECENT_WINDOW = 4  # IS 456 group criterion is over 4 consecutive results


class AlertService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def evaluate_on_test(self, test: CubeTest, pour: Pour) -> None:
        """Raise an alert if a 28-day result fails the individual criterion or
        drags the moving average below the IS-456 acceptance floor."""
        if test.test_age_days != ACCEPTANCE_AGE_DAYS:
            return
        grade = await self.session.get(Grade, pour.grade_id)
        if not grade or grade.min_strength_mpa is None:
            return
        fck = float(grade.min_strength_mpa)
        recent = await self._recent_28day(pour.project_id, pour.grade_id)
        verdict = quality_engine.evaluate_strength_alert(
            float(test.observed_strength_mpa), fck, recent
        )
        if verdict is None:
            return
        level, category, message = verdict
        self.session.add(
            Alert(
                project_id=pour.project_id,
                level=AlertLevel(level),
                category=category,
                title=f"{grade.grade_name} strength alert — {pour.pour_reference or 'pour'}",
                message=message,
                sample_id=test.sample_id,
                pour_id=pour.pour_id,
                supplier_id=pour.supplier_horizontal_id,
            )
        )
        await self.session.flush()

    async def _recent_28day(self, project_id: int, grade_id: int) -> list[float]:
        """The most recent 28-day results for a project+grade (oldest first),
        including the one just submitted."""
        rows = (
            await self.session.execute(
                select(CubeTest.observed_strength_mpa)
                .join(CubeSample, CubeSample.sample_id == CubeTest.sample_id)
                .join(Pour, Pour.pour_id == CubeSample.pour_id)
                .where(
                    Pour.project_id == project_id,
                    Pour.grade_id == grade_id,
                    CubeTest.test_age_days == ACCEPTANCE_AGE_DAYS,
                )
                .order_by(CubeTest.test_date.desc(), CubeTest.test_id.desc())
                .limit(_RECENT_WINDOW)
            )
        ).scalars().all()
        return [float(x) for x in reversed(rows)]

    # ── Feed (QE + PM) ─────────────────────────────────────────────────────────

    async def list_open(self, project: Project) -> list[AlertResponse]:
        rows = (
            await self.session.execute(
                select(Alert, Supplier.supplier_name)
                .outerjoin(Supplier, Supplier.supplier_id == Alert.supplier_id)
                .where(
                    Alert.project_id == project.project_id,
                    Alert.status == AlertStatus.OPEN,
                )
                .order_by(Alert.created_at.desc())
            )
        ).all()
        out: list[AlertResponse] = []
        for alert, supplier_name in rows:
            resp = AlertResponse.model_validate(alert)
            resp.supplier_name = supplier_name
            out.append(resp)
        return out

    async def count_open(self, project: Project) -> int:
        return (
            await self.session.execute(
                select(func.count(Alert.alert_id)).where(
                    Alert.project_id == project.project_id,
                    Alert.status == AlertStatus.OPEN,
                )
            )
        ).scalar_one()

    async def acknowledge(
        self, project: Project, alert_id: int, user: User
    ) -> AlertResponse:
        alert = await self.session.get(Alert, alert_id)
        if not alert or alert.project_id != project.project_id:
            raise NotFoundError("Alert")
        alert.status = AlertStatus.ACKNOWLEDGED
        alert.acknowledged_by = user.user_id
        alert.acknowledged_at = datetime.now(UTC)
        await self.session.flush()
        resp = AlertResponse.model_validate(alert)
        supplier = (
            await self.session.get(Supplier, alert.supplier_id)
            if alert.supplier_id
            else None
        )
        resp.supplier_name = supplier.supplier_name if supplier else None
        return resp
