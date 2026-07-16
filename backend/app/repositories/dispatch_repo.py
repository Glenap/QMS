"""dispatch_repo.py — DB queries for RMC dispatches and their truck tokens.

A dispatch carries its own ``project_id`` (it is raised before any pour exists),
so the project-scoped queries filter on it directly. The optional pour filter and
the pour↔dispatch reverse lookups still go through ``PourDispatchLink``.
"""

from sqlalchemy import select

from app.models.transaction import (
    PourDispatchLink,
    RMCDispatch,
    TruckDispatch,
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

    async def dispatch_id_for_pour(self, pour_id: int) -> int | None:
        res = await self.session.execute(
            select(PourDispatchLink.dispatch_id).where(
                PourDispatchLink.pour_id == pour_id
            )
        )
        return res.scalar_one_or_none()

    async def list_for_project(
        self, project_id: int, pour_id: int | None = None
    ) -> list[RMCDispatch]:
        q = select(RMCDispatch).where(RMCDispatch.project_id == project_id)
        if pour_id is not None:
            q = q.join(
                PourDispatchLink,
                PourDispatchLink.dispatch_id == RMCDispatch.dispatch_id,
            ).where(PourDispatchLink.pour_id == pour_id)
        q = q.order_by(RMCDispatch.created_at.desc())
        res = await self.session.execute(q)
        return list(res.scalars().all())

    async def get_in_project(
        self, dispatch_id: int, project_id: int
    ) -> RMCDispatch | None:
        res = await self.session.execute(
            select(RMCDispatch).where(
                RMCDispatch.dispatch_id == dispatch_id,
                RMCDispatch.project_id == project_id,
            )
        )
        return res.scalar_one_or_none()


class TruckRepository(BaseRepository[TruckDispatch]):
    model = TruckDispatch

    async def get_by_token(self, token: str) -> TruckDispatch | None:
        return await self.get_by(TruckDispatch.token == token)

    async def get_for_dispatch(self, dispatch_id: int) -> TruckDispatch | None:
        return await self.get_by(TruckDispatch.dispatch_id == dispatch_id)
