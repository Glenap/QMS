"""
seed.py — reference-data catalogs (grades, components).

These are global, admin-curated catalogs that pour cards select from. They are
seeded once into the live DB by an Alembic data migration and re-seeded per
test in the conftest engine fixture (the test schema is rebuilt from the models,
not migrations, so it has no data of its own).

GradeThresholds (per-age strength acceptance bands, IS 456) are intentionally
deferred to the quality-engine phase — they aren't needed to populate the pour
card and would couple this seed to FK-dependent rows.
"""

from app.models.master import ComponentType, GradeType

# Standard Indian RMC concrete grades. min_strength_mpa = characteristic
# compressive strength at 28 days (the "M" number).
GRADES: list[dict] = [
    {"grade_name": "M10", "grade_type": GradeType.NORMAL.value, "min_strength_mpa": 10, "grade_variant": None},
    {"grade_name": "M15", "grade_type": GradeType.NORMAL.value, "min_strength_mpa": 15, "grade_variant": None},
    {"grade_name": "M20", "grade_type": GradeType.NORMAL.value, "min_strength_mpa": 20, "grade_variant": None},
    {"grade_name": "M25", "grade_type": GradeType.NORMAL.value, "min_strength_mpa": 25, "grade_variant": None},
    {"grade_name": "M30", "grade_type": GradeType.NORMAL.value, "min_strength_mpa": 30, "grade_variant": None},
    {"grade_name": "M35", "grade_type": GradeType.NORMAL.value, "min_strength_mpa": 35, "grade_variant": None},
    {"grade_name": "M40", "grade_type": GradeType.NORMAL.value, "min_strength_mpa": 40, "grade_variant": None},
    {"grade_name": "M45", "grade_type": GradeType.NORMAL.value, "min_strength_mpa": 45, "grade_variant": None},
    {"grade_name": "M50", "grade_type": GradeType.NORMAL.value, "min_strength_mpa": 50, "grade_variant": None},
    {"grade_name": "M50 SCC", "grade_type": GradeType.FREE_FLOW.value, "min_strength_mpa": 50, "grade_variant": "SCC"},
    {"grade_name": "M60 SCC", "grade_type": GradeType.FREE_FLOW.value, "min_strength_mpa": 60, "grade_variant": "SCC"},
]

# One row per structural component type (mirrors ComponentType).
COMPONENTS: list[dict] = [
    {"component_type": ComponentType.FOUNDATION.value, "description": "Foundation / footing"},
    {"component_type": ComponentType.RAFT.value, "description": "Raft slab"},
    {"component_type": ComponentType.COLUMN.value, "description": "Vertical column"},
    {"component_type": ComponentType.SHEAR_WALL.value, "description": "Shear wall"},
    {"component_type": ComponentType.BEAM.value, "description": "Beam"},
    {"component_type": ComponentType.SLAB.value, "description": "Floor / roof slab"},
    {"component_type": ComponentType.STAIRCASE.value, "description": "Staircase"},
    {"component_type": ComponentType.LIFT_CORE.value, "description": "Lift core"},
]
