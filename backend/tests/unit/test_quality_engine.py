"""Unit tests for the IS 456 cube-strength quality engine (pure functions)."""

import pytest

from app.core import quality_engine
from app.models.quality import ResultStatus


class TestRequiredStrength:
    def test_28_day_is_full_characteristic_strength(self):
        assert quality_engine.required_strength(40, 28) == 40.0

    def test_7_day_is_65_percent(self):
        assert quality_engine.required_strength(40, 7) == 26.0

    def test_explicit_threshold_overrides_age_fraction(self):
        # A pinned GradeThreshold wins over the default fraction.
        assert quality_engine.required_strength(40, 7, threshold_mpa=30) == 30.0

    def test_unknown_age_beyond_28_is_full_strength(self):
        assert quality_engine.required_strength(30, 56) == 30.0

    def test_age_fraction_is_monotonic(self):
        # A later test age must never require a smaller fraction than an earlier
        # one (the old flat 7-day fallback made 15–27d require *less* than 14d).
        fractions = [quality_engine.age_fraction(age) for age in range(1, 40)]
        assert fractions == sorted(fractions)
        # Specifically: a 21-day cube is held to the 14-day bar, not the 7-day one.
        assert quality_engine.age_fraction(21) == quality_engine.age_fraction(14)
        assert quality_engine.age_fraction(21) > quality_engine.age_fraction(7)


class TestClassify:
    @pytest.mark.parametrize(
        "observed,required,expected",
        [
            (40.0, 40.0, ResultStatus.PASS),       # exactly meets
            (41.5, 40.0, ResultStatus.PASS),       # exceeds
            (39.9, 40.0, ResultStatus.FAIL),       # marginal miss
            (34.0, 40.0, ResultStatus.FAIL),       # exactly 85%
            (33.9, 40.0, ResultStatus.CRITICAL_FAILURE),  # below 85%
            (10.0, 40.0, ResultStatus.CRITICAL_FAILURE),
        ],
    )
    def test_bands(self, observed, required, expected):
        assert quality_engine.classify(observed, required) == expected

    def test_zero_required_does_not_divide_by_zero(self):
        assert quality_engine.classify(10.0, 0) == ResultStatus.PASS
        assert quality_engine.classify(0.0, 0) == ResultStatus.PENDING


class TestTargetMeanStrength:
    def test_assumed_std_dev_by_grade(self):
        assert quality_engine.assumed_std_dev(30) == 5.0
        assert quality_engine.assumed_std_dev(20) == 4.0
        assert quality_engine.assumed_std_dev(15) == 3.5

    def test_target_mean_uses_assumed_sigma(self):
        # IS 10262 M30: fck 30 + 1.65 * 5.0 = 38.25
        assert quality_engine.target_mean_strength(30) == 38.25

    def test_target_mean_with_explicit_sigma(self):
        assert quality_engine.target_mean_strength(30, 4.0) == round(30 + 1.65 * 4.0, 2)


class TestAcceptanceCriteria:
    def test_individual_ok_at_fck_minus_3(self):
        assert quality_engine.individual_ok(27, 30) is True
        assert quality_engine.individual_ok(26.9, 30) is False

    def test_group_min_mean_takes_the_greater(self):
        # M30 assumed σ=5 → max(30+3, 30+0.825*5=34.125) ≈ 34.12
        assert quality_engine.group_min_mean(30) == 34.12
        # small σ → the flat fck+3 dominates
        assert quality_engine.group_min_mean(30, 2.0) == 33.0

    def test_individual_failure_does_not_alert(self):
        # A single failing 28-day result auto-raises an NCR, so surfacing it as an
        # alert too would just duplicate the NCR — the engine stays silent.
        assert quality_engine.evaluate_strength_alert(26.0, 30, [26.0]) is None

    def test_below_characteristic_does_not_alert(self):
        # Below fck (but above fck−3) is an NCR too (FAIL) — not an alert.
        assert quality_engine.evaluate_strength_alert(29.0, 30, [29.0]) is None

    def test_group_average_drift_is_warning(self):
        # each ≥ 27 (individual OK, no NCR) but the 4-sample mean 28.25 < 34.125 —
        # the one strength signal no single NCR captures.
        res = quality_engine.evaluate_strength_alert(28.0, 30, [28.0, 29.0, 28.0, 28.0])
        assert res is not None and res[0] == "WARNING" and res[1] == "STRENGTH_GROUP"

    def test_group_criterion_needs_four_samples(self):
        # Fewer than 4 same-grade results → no group verdict yet.
        assert quality_engine.evaluate_strength_alert(28.0, 30, [28.0, 29.0, 28.0]) is None

    def test_healthy_result_has_no_alert(self):
        assert quality_engine.evaluate_strength_alert(35.0, 30, [35.0, 36.0, 34.0, 35.0]) is None
