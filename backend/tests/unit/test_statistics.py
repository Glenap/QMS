"""Unit tests for app.core.statistics — the pure Student's t machinery.

Anchored to textbook / table values so a numerical regression in the incomplete
beta or the bisection PPF is caught immediately.
"""

import math

import pytest

from app.core.statistics import (
    one_sample_t,
    student_t_cdf,
    student_t_ppf,
    two_sample_welch_t,
)

# ── Distribution primitives ──────────────────────────────────────────────────

def test_cdf_at_zero_is_half():
    for df in (1, 4, 10, 100):
        assert student_t_cdf(0.0, df) == pytest.approx(0.5, abs=1e-9)


def test_cdf_cauchy_known_value():
    # Student-t with df=1 is the standard Cauchy: CDF(1) = 0.75.
    assert student_t_cdf(1.0, 1.0) == pytest.approx(0.75, abs=1e-4)


def test_cdf_is_symmetric():
    for t, df in ((1.5, 6), (2.3, 12), (0.7, 3)):
        assert student_t_cdf(-t, df) == pytest.approx(1.0 - student_t_cdf(t, df), abs=1e-6)


@pytest.mark.parametrize(
    ("p", "df", "expected"),
    [
        (0.975, 10, 2.2281),   # two-sided 95% critical value, df=10
        (0.95, 10, 1.8125),    # one-sided 95%, df=10
        (0.995, 10, 3.1693),   # two-sided 99%, df=10
        (0.975, 1000, 1.9623), # approaches the normal 1.96 for large df
    ],
)
def test_ppf_matches_t_table(p, df, expected):
    assert student_t_ppf(p, df) == pytest.approx(expected, abs=2e-3)


def test_ppf_cdf_round_trip():
    for p, df in ((0.9, 7), (0.3, 15), (0.66, 4)):
        assert student_t_cdf(student_t_ppf(p, df), df) == pytest.approx(p, abs=1e-4)


def test_two_sided_tail_at_critical_value_is_alpha():
    # At the 97.5% quantile the two-sided tail must be 0.05 (df=10).
    t_crit = student_t_ppf(0.975, 10)
    # one_sample not needed; derive the tail directly from the CDF.
    tail = 2.0 * (1.0 - student_t_cdf(t_crit, 10))
    assert tail == pytest.approx(0.05, abs=1e-3)


# ── One-sample t-test ────────────────────────────────────────────────────────

def test_one_sample_exact_statistic_and_ci():
    res = one_sample_t([2, 4, 6, 8, 10], 0.0, confidence=0.95, alternative="two_sided")
    assert res.n == 5
    assert res.mean == pytest.approx(6.0)
    assert res.std_dev == pytest.approx(math.sqrt(10), abs=1e-4)
    assert res.std_error == pytest.approx(1.41421, abs=1e-4)
    assert res.t_statistic == pytest.approx(4.2426, abs=1e-3)
    assert res.df == 4.0
    assert res.significant is True                    # p well under 0.05
    # 95% CI = mean ± t(.975,4)=2.7764 · se
    assert res.ci_low == pytest.approx(2.0736, abs=2e-3)
    assert res.ci_high == pytest.approx(9.9264, abs=2e-3)


def test_one_sample_on_the_mark_is_not_significant():
    res = one_sample_t([1, 2, 3, 4, 5], 3.0)
    assert res.t_statistic == pytest.approx(0.0, abs=1e-9)
    assert res.p_value == pytest.approx(1.0, abs=1e-6)
    assert res.significant is False


def test_one_sample_greater_alternative_halves_p():
    two = one_sample_t([2, 4, 6, 8, 10], 0.0, alternative="two_sided")
    grt = one_sample_t([2, 4, 6, 8, 10], 0.0, alternative="greater")
    # For a positive t, the one-sided (greater) p is half the two-sided p.
    assert grt.p_value == pytest.approx(two.p_value / 2.0, rel=1e-3)
    assert grt.significant is True


def test_one_sample_confidence_widens_interval():
    narrow = one_sample_t([2, 4, 6, 8, 10], 0.0, confidence=0.90)
    wide = one_sample_t([2, 4, 6, 8, 10], 0.0, confidence=0.99)
    span_narrow = narrow.ci_high - narrow.ci_low
    span_wide = wide.ci_high - wide.ci_low
    assert span_wide > span_narrow


def test_one_sample_degenerate_identical_values():
    on_mark = one_sample_t([5, 5, 5], 5.0)
    assert on_mark.t_statistic == 0.0
    assert on_mark.p_value == pytest.approx(1.0)
    assert on_mark.ci_low == on_mark.ci_high == 5.0

    off = one_sample_t([5, 5, 5], 3.0, alternative="greater")
    assert math.isinf(off.t_statistic) and off.t_statistic > 0
    assert off.p_value == 0.0
    assert off.significant is True


def test_one_sample_needs_two_points():
    with pytest.raises(ValueError):
        one_sample_t([5.0], 3.0)


def test_bad_confidence_raises():
    with pytest.raises(ValueError):
        one_sample_t([1, 2, 3], 2.0, confidence=1.5)


# ── Two-sample Welch t-test ──────────────────────────────────────────────────

def test_two_sample_exact_statistic_and_df():
    # a and b have equal variance and n → Welch reduces to a clean t=-2, df=8.
    res = two_sample_welch_t([1, 2, 3, 4, 5], [3, 4, 5, 6, 7], alternative="two_sided")
    assert res.mean1 == pytest.approx(3.0)
    assert res.mean2 == pytest.approx(5.0)
    assert res.mean_diff == pytest.approx(-2.0)
    assert res.t_statistic == pytest.approx(-2.0, abs=1e-6)
    assert res.df == pytest.approx(8.0, abs=1e-6)
    assert res.significant is False                   # two-sided p ≈ 0.081 > 0.05


def test_two_sample_less_alternative_significant():
    # a is clearly below b; a one-sided "less" test rejects at 95%.
    res = two_sample_welch_t([1, 2, 3, 4, 5], [3, 4, 5, 6, 7], alternative="less")
    assert res.p_value == pytest.approx(0.0404, abs=5e-3)
    assert res.significant is True


def test_two_sample_ci_is_for_difference():
    res = two_sample_welch_t([1, 2, 3, 4, 5], [3, 4, 5, 6, 7])
    # CI brackets the true difference (−2) and, since not significant, straddles 0.
    assert res.ci_low < -2.0 < res.ci_high
    assert res.ci_low < 0.0 < res.ci_high


def test_two_sample_needs_two_per_group():
    with pytest.raises(ValueError):
        two_sample_welch_t([1.0], [3, 4, 5])
    with pytest.raises(ValueError):
        two_sample_welch_t([1, 2, 3], [3.0])
