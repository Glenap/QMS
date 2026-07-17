"""schemas/analytics.py — Phase 6 read-only analytics DTOs.

Shaped, denormalised metric bundles for the Overview + Analytics dashboards.
Everything here is computed deterministically by ``analytics_service`` (SQL /
maths) — that service is the single source of truth the dashboards read (and,
later, the AI query layer). Fields are additive by design: new metrics append,
they never restructure an existing bundle, so forms/columns can keep growing.
"""

from datetime import date
from typing import Literal

from pydantic import BaseModel, Field


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


# ── Phase 5B: the four IS-456/10262 statistical charts (all filter-driven) ────


class RunPoint(BaseModel):
    """One individual 28-day result on the quality-control run chart."""

    test_date: str  # ISO date
    observed_mpa: float
    grade_name: str | None = None
    tower_name: str | None = None
    reference: str | None = None  # pour reference (kept for back-compat)
    sample_reference: str | None = None  # the cube number — the point's identity
    sample_id: int | None = None  # for deep-linking to traceability


class RunChart(BaseModel):
    """Chronological individual results + IS-456 control lines. Control lines are
    populated only when the data is a single grade (one fck)."""

    points: list[RunPoint] = []
    grade_name: str | None = None
    fck: float | None = None
    individual_min: float | None = None  # fck − 3
    target_mean: float | None = None  # fck + 1.65·σ
    mean: float | None = None


class CusumPoint(BaseModel):
    index: int  # cube number — chronological sequence, 1-based
    sample_reference: str | None = None
    sample_id: int | None = None
    test_date: str  # ISO date
    observed_mpa: float
    deviation: float  # observed − target mean
    cusum: float  # running cumulative sum of deviations


class CusumChart(BaseModel):
    """CUSUM control chart (IS-456 / SPC): the running sum of (observed − target
    mean) plotted by cube number. A sustained downward slope signals a fall in
    mean strength earlier than raw pass/fail. Single-grade (one target mean)."""

    points: list[CusumPoint] = []
    grade_name: str | None = None
    target_mean: float | None = None


class CurvePoint(BaseModel):
    x: float
    y: float


class DistributionCurve(BaseModel):
    """Normal distribution of the filtered strength dataset (IS-10262 basis)."""

    sample_count: int = 0
    mean: float | None = None
    std_dev: float | None = None
    fck: float | None = None
    curve: list[CurvePoint] = []  # sampled bell curve
    histogram: list[StrengthBucket] = []


class TargetMeanRow(BaseModel):
    grade_name: str
    fck: float
    target_mean: float  # fck + 1.65·σ
    actual_mean: float | None = None
    sample_count: int = 0


class TargetMeanChart(BaseModel):
    rows: list[TargetMeanRow] = []


class AgePoint(BaseModel):
    test_age_days: int
    observed_mpa: float
    required_mpa: float | None = None


class StrengthAgeChart(BaseModel):
    """Compressive strength vs age for a specific pour/element."""

    points: list[AgePoint] = []
    grade_name: str | None = None
    reference: str | None = None


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


# ── Statistical tests (Student's t) ──────────────────────────────────────────
# Inference over cube-strength results: does a selection meet spec (one-sample),
# and do two selections differ (two-sample)? The confidence level defaults to
# 95% and is caller-adjustable. See app/core/statistics.py for the pure maths.

Alternative = Literal["two_sided", "greater", "less"]


class OneSampleTTest(BaseModel):
    """Result of testing a selection's mean cube strength against a reference."""

    sample_count: int
    mean: float
    std_dev: float
    std_error: float
    mu0: float
    mu0_basis: str  # 'fck' | 'target' | 'custom'
    grade_name: str | None = None
    values: list[float] = []  # the individual observed strengths (for plotting)
    t_statistic: float
    df: float
    p_value: float
    alternative: Alternative
    confidence: float
    ci_low: float
    ci_high: float
    significant: bool
    verdict: str


class GroupFilter(BaseModel):
    """The dimension selection defining one comparison group (two-sample test)."""

    grade_id: int | None = None
    tower_id: int | None = None
    supplier_id: int | None = None
    contractor_id: int | None = None
    date_from: date | None = None
    date_to: date | None = None
    label: str | None = None  # optional display name for the group


class TwoSampleRequest(BaseModel):
    group_a: GroupFilter
    group_b: GroupFilter
    confidence: float = Field(default=0.95, gt=0.5, lt=1.0)
    alternative: Alternative = "two_sided"


class GroupSummary(BaseModel):
    label: str
    sample_count: int
    mean: float | None = None
    std_dev: float | None = None
    values: list[float] = []  # the group's individual strengths (for plotting)


class TwoSampleTTest(BaseModel):
    """Welch two-sample t-test comparing two selections' mean cube strengths."""

    group_a: GroupSummary
    group_b: GroupSummary
    mean_diff: float
    t_statistic: float
    df: float
    p_value: float
    alternative: Alternative
    confidence: float
    ci_low: float
    ci_high: float
    significant: bool
    verdict: str
