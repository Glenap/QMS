"""cube_repo.py — DB queries for cube samples, cube tests, and NCRs.

A cube sample lives in the transaction schema and is scoped to a project through
its pour (CubeSample → Pour → project_id); cube tests and NCRs hang off the
sample/pour, so the project-scoped queries here join through that chain.
"""

from sqlalchemy import and_, select

from app.models.quality import (
    NCR,
    CorrectiveAction,
    CubeTest,
    NcrRmcNotification,
    NCRStatus,
    Retest,
)
from app.models.transaction import CubeSample, Pour
from app.repositories.base_repo import BaseRepository


class CubeSampleRepository(BaseRepository[CubeSample]):
    model = CubeSample

    async def get_in_project(
        self, sample_id: int, project_id: int
    ) -> CubeSample | None:
        q = (
            select(CubeSample)
            .join(Pour, Pour.pour_id == CubeSample.pour_id)
            .where(
                CubeSample.sample_id == sample_id,
                Pour.project_id == project_id,
            )
        )
        res = await self.session.execute(q)
        return res.scalar_one_or_none()

    async def list_for_pour(self, pour_id: int) -> list[CubeSample]:
        return await self.list_by(
            CubeSample.pour_id == pour_id, order_by=CubeSample.cast_date.desc()
        )

    async def list_for_project(self, project_id: int) -> list[CubeSample]:
        q = (
            select(CubeSample)
            .join(Pour, Pour.pour_id == CubeSample.pour_id)
            .where(Pour.project_id == project_id)
            .order_by(CubeSample.cast_date.desc(), CubeSample.sample_id.desc())
        )
        res = await self.session.execute(q)
        return list(res.scalars().all())


class CubeTestRepository(BaseRepository[CubeTest]):
    model = CubeTest

    async def list_for_sample(self, sample_id: int) -> list[CubeTest]:
        return await self.list_by(
            CubeTest.sample_id == sample_id, order_by=CubeTest.test_age_days.asc()
        )

    async def list_for_samples(self, sample_ids: list[int]) -> list[CubeTest]:
        if not sample_ids:
            return []
        return await self.list_by(
            CubeTest.sample_id.in_(sample_ids), order_by=CubeTest.test_age_days.asc()
        )


class NCRRepository(BaseRepository[NCR]):
    model = NCR

    async def get_in_project(self, ncr_id: int, project_id: int) -> NCR | None:
        q = (
            select(NCR)
            .join(Pour, Pour.pour_id == NCR.pour_id)
            .where(NCR.ncr_id == ncr_id, Pour.project_id == project_id)
        )
        res = await self.session.execute(q)
        return res.scalar_one_or_none()

    async def list_for_project(self, project_id: int) -> list[NCR]:
        q = (
            select(NCR)
            .join(Pour, Pour.pour_id == NCR.pour_id)
            .where(Pour.project_id == project_id)
            .order_by(NCR.raised_at.desc())
        )
        res = await self.session.execute(q)
        return list(res.scalars().all())

    async def list_resolved_for_project(
        self, project_id: int, *, exclude_ncr_id: int | None = None
    ) -> list[NCR]:
        """CLOSED NCRs in the project that carry a root cause — the Phase-9 RAG
        corpus of past resolved cases (optionally excluding one NCR)."""
        conds = [
            Pour.project_id == project_id,
            NCR.status == NCRStatus.CLOSED,
            NCR.root_cause.isnot(None),
        ]
        if exclude_ncr_id is not None:
            conds.append(NCR.ncr_id != exclude_ncr_id)
        q = (
            select(NCR)
            .join(Pour, Pour.pour_id == NCR.pour_id)
            .where(and_(*conds))
            .order_by(NCR.closed_at.desc())
        )
        res = await self.session.execute(q)
        return list(res.scalars().all())


class CorrectiveActionRepository(BaseRepository[CorrectiveAction]):
    model = CorrectiveAction

    async def list_for_ncr(self, ncr_id: int) -> list[CorrectiveAction]:
        return await self.list_by(
            CorrectiveAction.ncr_id == ncr_id,
            order_by=CorrectiveAction.created_at.asc(),
        )

    async def list_for_ncrs(self, ncr_ids: list[int]) -> list[CorrectiveAction]:
        if not ncr_ids:
            return []
        return await self.list_by(CorrectiveAction.ncr_id.in_(ncr_ids))

    async def get_in_ncr(
        self, action_id: int, ncr_id: int
    ) -> CorrectiveAction | None:
        return await self.get_by(
            CorrectiveAction.action_id == action_id,
            CorrectiveAction.ncr_id == ncr_id,
        )


class RetestRepository(BaseRepository[Retest]):
    model = Retest

    async def list_for_ncr(self, ncr_id: int) -> list[Retest]:
        return await self.list_by(
            Retest.ncr_id == ncr_id, order_by=Retest.created_at.asc()
        )

    async def list_for_ncrs(self, ncr_ids: list[int]) -> list[Retest]:
        if not ncr_ids:
            return []
        return await self.list_by(Retest.ncr_id.in_(ncr_ids))

    async def list_for_project(self, project_id: int) -> list[Retest]:
        """Every retest across the project's NCRs (newest first), for the
        project-level Retests page."""
        q = (
            select(Retest)
            .join(NCR, NCR.ncr_id == Retest.ncr_id)
            .join(Pour, Pour.pour_id == NCR.pour_id)
            .where(Pour.project_id == project_id)
            .order_by(Retest.created_at.desc())
        )
        res = await self.session.execute(q)
        return list(res.scalars().all())

    async def get_in_ncr(self, retest_id: int, ncr_id: int) -> Retest | None:
        return await self.get_by(
            Retest.retest_id == retest_id, Retest.ncr_id == ncr_id
        )


class NcrRmcNotificationRepository(BaseRepository[NcrRmcNotification]):
    model = NcrRmcNotification

    async def list_for_ncr(self, ncr_id: int) -> list[NcrRmcNotification]:
        return await self.list_by(
            NcrRmcNotification.ncr_id == ncr_id,
            order_by=NcrRmcNotification.sent_at.asc(),
        )

    async def list_for_ncrs(self, ncr_ids: list[int]) -> list[NcrRmcNotification]:
        if not ncr_ids:
            return []
        return await self.list_by(NcrRmcNotification.ncr_id.in_(ncr_ids))
