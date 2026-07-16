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

# IS 10262 assumed standard deviation (N/mm²) by characteristic strength, used
# when there isn't enough site data (< ~30 results) to compute σ reliably.
ASSUMED_STD_DEV: dict[int, float] = {
    10: 3.5, 15: 3.5, 20: 4.0, 25: 4.0, 30: 5.0,
    35: 5.0, 40: 5.0, 45: 5.0, 50: 5.0, 55: 5.0, 60: 5.0,
}


def assumed_std_dev(fck: float) -> float:
    """IS 10262 assumed σ for the characteristic strength at/below ``fck``."""
    keys = [k for k in ASSUMED_STD_DEV if k <= fck]
    return ASSUMED_STD_DEV[max(keys)] if keys else ASSUMED_STD_DEV[min(ASSUMED_STD_DEV)]


def target_mean_strength(fck: float, std_dev: float | None = None) -> float:
    """IS 10262 target mean strength = fck + 1.65·S (S = assumed σ if not given)."""
    s = std_dev if std_dev is not None else assumed_std_dev(fck)
    return round(float(fck) + 1.65 * float(s), 2)


# ── IS 456 Clause 16 acceptance criteria (used by the alerting layer) ──────────

INDIVIDUAL_MARGIN = 3.0  # an individual test must be ≥ fck − 3
GROUP_MARGIN = 3.0       # the mean of 4 must be ≥ fck + 3 …
GROUP_STD_FACTOR = 0.825  # … or fck + 0.825·S, whichever is greater


def individual_ok(observed: float, fck: float) -> bool:
    """IS 456: an individual result is acceptable if ≥ fck − 3 N/mm²."""
    return float(observed) >= float(fck) - INDIVIDUAL_MARGIN


def group_min_mean(fck: float, std_dev: float | None = None) -> float:
    """IS 456 acceptance floor for the mean of 4 consecutive results —
    max(fck + 3, fck + 0.825·S)."""
    s = std_dev if std_dev is not None else assumed_std_dev(fck)
    return round(
        max(float(fck) + GROUP_MARGIN, float(fck) + GROUP_STD_FACTOR * float(s)), 2
    )


def group_ok(mean_of_four: float, fck: float, std_dev: float | None = None) -> bool:
    return float(mean_of_four) >= group_min_mean(fck, std_dev)


def evaluate_strength_alert(
    observed: float,
    fck: float,
    recent_observed: list[float],
    std_dev: float | None = None,
) -> tuple[str, str, str] | None:
    """Grade a new 28-day result against the IS 456 **group** criterion and
    return ``(level, category, message)`` for an alert, or ``None`` when it's
    clear. ``recent_observed`` is the run of same-grade individual results (most
    recent last), including this one.

    Quality alerts are deliberately scoped to what NCRs don't already catch. An
    individual 28-day result below the characteristic strength (``observed <
    fck``) always auto-raises an NCR (``cube_service._raise_ncr`` on FAIL/CRITICAL),
    so surfacing that same individual as an alert would just duplicate the NCR.
    The one strength signal *no* single NCR captures is the 4-sample moving
    average drifting below the acceptance floor — a run of individually-passing
    results that together fail the group criterion (IS 456 cl. 16). That is the
    only case this raises.
    """
    observed = float(observed)
    fck = float(fck)

    window = [float(x) for x in recent_observed][-4:]
    if len(window) >= 4:
        avg = sum(window) / 4
        floor = group_min_mean(fck, std_dev)
        if avg < floor:
            return (
                "WARNING",
                "STRENGTH_GROUP",
                f"The 4-sample moving average {round(avg, 2)} MPa is below the IS 456 "
                f"acceptance floor {floor} MPa — production is drifting toward failure. "
                "Review the RMC plant and notify them; increase testing frequency.",
            )
    return None


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
