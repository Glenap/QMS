"""quality_engine.py — IS 456 cube-strength acceptance logic.

A pure, dependency-free module (no DB, no I/O) so it is trivially unit-testable
and can be reused by the cube-test service and, later, the analytics layer.

It answers two questions for a single cube-strength result:

  1. ``required_strength`` — what compressive strength (MPa) the cube must reach
     at a given test age. At 28 days this is the grade's characteristic strength
     (the "M" number, ``Grade.min_strength_mpa``). Earlier ages use a fraction of
     it (IS 456 / common Indian site practice). A project may pin an explicit
     ``GradeThreshold`` per age, which overrides the fraction.

  2. ``classify`` — PASS / FAIL / CRITICAL_FAILURE for an observed vs required
     strength, per the band described on ``CubeTest`` (Clause 15.4):

        PASS             observed >= required
        FAIL             0.85 * required <= observed < required
        CRITICAL_FAILURE observed < 0.85 * required
"""

from app.models.quality import ResultStatus

# Fraction of the 28-day characteristic strength expected at an earlier test
# age. OPC-based RMC mixes typically reach ~65% by day 7 and ~90% by day 14.
# These are fallbacks only — an explicit GradeThreshold row (per grade+age)
# takes precedence when one exists.
DEFAULT_AGE_FRACTIONS: dict[int, float] = {3: 0.40, 7: 0.65, 14: 0.90, 28: 1.0}

# Below this fraction of the required strength a failure is "critical" — the
# concrete is well short of spec, not a marginal miss.
CRITICAL_FRACTION = 0.85


def age_fraction(test_age_days: int) -> float:
    """The fraction of 28-day strength expected at ``test_age_days``.

    Known ages come from ``DEFAULT_AGE_FRACTIONS``; an unknown age is stepped
    down to the nearest defined age at or below it (and an age below the
    smallest defined one uses that smallest fraction). This keeps the required
    strength **monotonic in age** — a 21-day cube is never held to a lower bar
    than a 14-day cube — which a flat 7-day fallback got wrong."""
    if test_age_days in DEFAULT_AGE_FRACTIONS:
        return DEFAULT_AGE_FRACTIONS[test_age_days]
    if test_age_days >= 28:
        return 1.0
    defined_at_or_below = [a for a in DEFAULT_AGE_FRACTIONS if a <= test_age_days]
    if defined_at_or_below:
        return DEFAULT_AGE_FRACTIONS[max(defined_at_or_below)]
    return DEFAULT_AGE_FRACTIONS[min(DEFAULT_AGE_FRACTIONS)]


def required_strength(
    characteristic_strength_mpa: float,
    test_age_days: int,
    threshold_mpa: float | None = None,
) -> float:
    """Required strength (MPa) for a cube at ``test_age_days``.

    ``threshold_mpa`` — an explicit per-age acceptance value (e.g. from a
    ``GradeThreshold`` row) — overrides the age-fraction estimate when given."""
    if threshold_mpa is not None:
        return round(float(threshold_mpa), 2)
    fck = float(characteristic_strength_mpa)
    return round(fck * age_fraction(test_age_days), 2)


def classify(observed_mpa: float, required_mpa: float) -> ResultStatus:
    """Grade an observed strength against its required value (IS 456 band)."""
    observed = float(observed_mpa)
    required = float(required_mpa)
    if required <= 0:
        # No meaningful target — treat any positive reading as a pass rather
        # than dividing by zero.
        return ResultStatus.PASS if observed > 0 else ResultStatus.PENDING
    if observed >= required:
        return ResultStatus.PASS
    if observed >= CRITICAL_FRACTION * required:
        return ResultStatus.FAIL
    return ResultStatus.CRITICAL_FAILURE
