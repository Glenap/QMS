"""catalog_repo.py — DB queries for the global grade + component catalogs."""

from app.models.master import Component, Grade
from app.repositories.base_repo import BaseRepository


class GradeRepository(BaseRepository[Grade]):
    model = Grade


class ComponentRepository(BaseRepository[Component]):
    model = Component
