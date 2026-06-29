"""schemas/analytics.py — Phase 6 read-only analytics DTOs.

Shaped, denormalised metric bundles for the Overview + Analytics dashboards.
Everything here is computed deterministically by ``analytics_service`` (SQL /
maths) — that service is the single source of truth the dashboards read (and,
later, the AI query layer). Fields are additive by design: new metrics append,
they never restructure an existing bundle, so forms/columns can keep growing.
"""

from pydantic import BaseModel


class OverviewKpis(BaseModel):
    """Top-of-dashboard KPI bundle for one project (whole-project, unfiltered)."""

    # Pours
    pour_count: int = 0
    pour_volume_cum: float = 0.0
    # Quality (cube strength tests)
    test_count: int = 0
    pass_count: int = 0
    fail_count: int = 0
    critical_count: int = 0
    pass_rate_pct: float | None = None
    avg_strength_mpa: float | None = None
    # NCRs
    ncr_open: int = 0
    ncr_under_review: int = 0
    ncr_closed: int = 0
    avg_days_to_close: float | None = None
    # Dispatch / gate (trucks)
    truck_total: int = 0
    truck_accepted: int = 0
    truck_rejected: int = 0
    acceptance_pct: float | None = None


class GradeTrendPoint(BaseModel):
    period: str  # 'YYYY-MM'
    grade_name: str
    test_count: int
    pass_count: int
    pass_rate_pct: float | None = None


class StrengthBucket(BaseModel):
    label: str  # e.g. '<35', '35-40'
    count: int


class ResultBreakdown(BaseModel):
    status: str  # PASS / FAIL / CRITICAL_FAILURE / PENDING
    count: int


class QualityAnalytics(BaseModel):
    """Quality charts for the Analytics page, honouring the dimension filters."""

    grade_trend: list[GradeTrendPoint] = []
    strength_distribution: list[StrengthBucket] = []
    result_breakdown: list[ResultBreakdown] = []


class SupplierScore(BaseModel):
    supplier_id: int
    supplier_name: str
    pour_count: int = 0
    pour_volume_cum: float = 0.0
    test_count: int = 0
    pass_count: int = 0
    pass_rate_pct: float | None = None
    avg_strength_mpa: float | None = None


class SupplierNcrCount(BaseModel):
    """NCRs raised against each supplier's pours, split by lifecycle + severity.

    ``open_count`` + ``closed_count`` = ``total`` (status is mutually exclusive);
    ``critical_count`` overlaps them — it counts the NCRs whose triggering cube
    test was a CRITICAL_FAILURE, regardless of whether they're open or closed.
    """

    supplier_id: int
    supplier_name: str
    open_count: int = 0
    closed_count: int = 0
    critical_count: int = 0
    total: int = 0
