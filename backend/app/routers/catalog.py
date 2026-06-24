"""catalog.py router — global reference catalogs (grades, components).

Read-only, available to any authenticated user. These drive the pour-card
dropdowns. The catalogs are seeded (see app/database/seed.py).
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.database.session import get_db
from app.models.auth import User
from app.schemas.master import ComponentResponse, GradeResponse
from app.services.catalog_service import CatalogService

router = APIRouter(tags=["catalog"])


@router.get("/grades", response_model=list[GradeResponse])
async def list_grades(
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """All concrete grades (M10…M60), ordered by strength."""
    return await CatalogService(db).list_grades()


@router.get("/components", response_model=list[ComponentResponse])
async def list_components(
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """All structural component types (column, slab, beam, …)."""
    return await CatalogService(db).list_components()
