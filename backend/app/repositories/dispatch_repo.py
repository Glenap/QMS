"""dispatch_repo.py — DB queries for RMC dispatches and their truck tokens.

A dispatch has no project_id of its own; it is scoped to a project through its
pour (PourDispatchLink → Pour → project_id), so the project-scoped queries here
join through that link.
"""

from sqlalchemy import func, select

from app.models.transaction import (
    Pour,
    PourDispatchLink,
    RMCDispatch,
    TruckDispatch,
    TruckStatus,
)
from app.repositories.base_repo import BaseRepository


class DispatchRepository(BaseRepository[RMCDispatch]):
    model = RMCDispatch

    async def pour_id_for(self, dispatch_id: int) -> int | None:
        res = await self.session.execute(
            select(PourDispatchLink.pour_id).where(
                PourDispatchLink.dispatch_id == dispatch_id
            )
        )
        return res.scalar_one_or_none()

    # ── Per-pour volume rollups (across all of a pour's dispatches) ──────────

    async def delivered_for_pours(self, pour_ids: list[int]) -> dict[int, float]:
        """Concrete actually delivered (ACCEPTED truck volume), per pour."""
        if not pour_ids:
            return {}
        q = (
            select(
                PourDispatchLink.pour_id,
                func.coalesce(func.sum(TruckDispatch.volume_cum), 0),
            )
            .join(
                TruckDispatch,
                TruckDispatch.dispatch_id == PourDispatchLink.dispatch_id,
            )
            .where(
                PourDispatchLink.pour_id.in_(pour_ids),
                TruckDispatch.status == TruckStatus.ACCEPTED,
            )
            .group_by(PourDispatchLink.pour_id)
        )
        res = await self.session.execute(q)
        return {pid: float(v) for pid, v in res.all()}

    async def outstanding_ordered_for_pours(self, pour_ids: list[int]) -> dict[int, float]:
        """Volume on orders that are placed but not yet resolved (truck PENDING /
        FILLED / ARRIVED), per pour. ACCEPTED counts as delivered instead, and a
        REJECTED order frees its volume — so an accepted-but-short delivery and a
        rejection both leave volume for the QE to re-order."""
        if not pour_ids:
            return {}
        q = (
            select(
                PourDispatchLink.pour_id,
                func.coalesce(func.sum(RMCDispatch.volume_ordered_cum), 0),
            )
            .join(RMCDispatch, RMCDispatch.dispatch_id == PourDispatchLink.dispatch_id)
            .join(TruckDispatch, TruckDispatch.dispatch_id == RMCDispatch.dispatch_id)
            .where(
                PourDispatchLink.pour_id.in_(pour_ids),
                TruckDispatch.status.in_(
                    [TruckStatus.PENDING, TruckStatus.FILLED, TruckStatus.ARRIVED]
                ),
            )
            .group_by(PourDispatchLink.pour_id)
        )
        res = await self.session.execute(q)
        return {pid: float(v) for pid, v in res.all()}

    async def delivered_for_pour(self, pour_id: int) -> float:
        return (await self.delivered_for_pours([pour_id])).get(pour_id, 0.0)

    async def list_for_project(
        self, project_id: int, pour_id: int | None = None
    ) -> list[RMCDispatch]:
        q = (
            select(RMCDispatch)
            .join(
                PourDispatchLink,
                PourDispatchLink.dispatch_id == RMCDispatch.dispatch_id,
            )
            .join(Pour, Pour.pour_id == PourDispatchLink.pour_id)
            .where(Pour.project_id == project_id)
        )
        if pour_id is not None:
            q = q.where(Pour.pour_id == pour_id)
        q = q.order_by(RMCDispatch.created_at.desc())
        res = await self.session.execute(q)
        return list(res.scalars().all())

    async def get_in_project(
        self, dispatch_id: int, project_id: int
    ) -> RMCDispatch | None:
        q = (
            select(RMCDispatch)
            .join(
                PourDispatchLink,
                PourDispatchLink.dispatch_id == RMCDispatch.dispatch_id,
            )
            .join(Pour, Pour.pour_id == PourDispatchLink.pour_id)
            .where(
                RMCDispatch.dispatch_id == dispatch_id,
                Pour.project_id == project_id,
            )
        )
        res = await self.session.execute(q)
        return res.scalar_one_or_none()


class TruckRepository(BaseRepository[TruckDispatch]):
    model = TruckDispatch

    async def get_by_token(self, token: str) -> TruckDispatch | None:
        return await self.get_by(TruckDispatch.token == token)

    async def get_for_dispatch(self, dispatch_id: int) -> TruckDispatch | None:
        return await self.get_by(TruckDispatch.dispatch_id == dispatch_id)
