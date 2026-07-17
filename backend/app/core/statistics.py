"""statistics.py — pure statistical inference for the analytics layer.

Student's t-test machinery for concrete quality control:

  * **one-sample** — does a batch of cube strengths significantly meet (or exceed)
    a reference value (the IS-456 characteristic strength ``fck``, the design
    target mean, or a custom threshold)?
  * **two-sample (Welch)** — do two selections (Supplier A vs B, Tower vs Tower,
    this period vs last) differ significantly in mean strength?

No third-party numerics (no scipy/numpy — the project stays lean). The Student's
t distribution is evaluated through the regularized incomplete beta function
(continued-fraction expansion, Numerical Recipes §6.4), so this module is a pure,
I/O-free, directly unit-tested core — same house rule as ``quality_engine``.

Convention: an ``alternative`` of ``"greater"`` tests H1: mean > reference (or
mean1 > mean2); ``"less"`` the reverse; ``"two_sided"`` tests inequality. The
confidence interval is always the two-sided interval at the given confidence.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from statistics import mean, stdev

__all__ = [
    "OneSampleResult",
    "TwoSampleResult",
    "one_sample_t",
    "student_t_cdf",
    "student_t_ppf",
    "two_sample_welch_t",
]

_ALTERNATIVES = ("two_sided", "greater", "less")


# ── Regularized incomplete beta Iₓ(a, b) ─────────────────────────────────────

def _betacf(a: float, b: float, x: float) -> float:
    """Continued fraction for the incomplete beta function (Lentz's method)."""
    tiny = 1e-30
    qab, qap, qam = a + b, a + 1.0, a - 1.0
    c = 1.0
    d = 1.0 - qab * x / qap
    if abs(d) < tiny:
        d = tiny
    d = 1.0 / d
    h = d
    for m in range(1, 200):
        m2 = 2 * m
        aa = m * (b - m) * x / ((qam + m2) * (a + m2))
        d = 1.0 + aa * d
        if abs(d) < tiny:
            d = tiny
        c = 1.0 + aa / c
        if abs(c) < tiny:
            c = tiny
        d = 1.0 / d
        h *= d * c
        aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))
        d = 1.0 + aa * d
        if abs(d) < tiny:
            d = tiny
        c = 1.0 + aa / c
        if abs(c) < tiny:
            c = tiny
        d = 1.0 / d
        delta = d * c
        h *= delta
        if abs(delta - 1.0) < 3.0e-12:
            break
    return h


def _betai(a: float, b: float, x: float) -> float:
    """Regularized incomplete beta Iₓ(a, b) for 0 ≤ x ≤ 1."""
    if x <= 0.0:
        return 0.0
    if x >= 1.0:
        return 1.0
    lbeta = math.lgamma(a + b) - math.lgamma(a) - math.lgamma(b)
    front = math.exp(lbeta + a * math.log(x) + b * math.log(1.0 - x))
    # Use whichever tail converges (the CF is well-behaved for x < (a+1)/(a+b+2)).
    if x < (a + 1.0) / (a + b + 2.0):
        return front * _betacf(a, b, x) / a
    return 1.0 - front * _betacf(b, a, 1.0 - x) / b


# ── Student's t distribution ─────────────────────────────────────────────────

def _t_sf_two_sided(t: float, df: float) -> float:
    """P(|T| > |t|) for T ~ Student-t(df) — the two-sided tail probability."""
    if df <= 0:
        raise ValueError("degrees of freedom must be positive")
    if math.isinf(t):
        return 0.0
    x = df / (df + t * t)
    return _betai(df / 2.0, 0.5, x)


def student_t_cdf(t: float, df: float) -> float:
    """Cumulative distribution P(T ≤ t) for T ~ Student-t(df)."""
    tail = _t_sf_two_sided(t, df)  # = P(|T| > |t|)
    return 1.0 - tail / 2.0 if t >= 0 else tail / 2.0


def student_t_ppf(p: float, df: float) -> float:
    """Inverse CDF (quantile) for Student-t(df); ``p`` in (0, 1).

    Bisection on the monotone CDF — precise enough for critical values and free
    of any distributional-approximation tables.
    """
    if not 0.0 < p < 1.0:
        raise ValueError("p must be in (0, 1)")
    if p == 0.5:
        return 0.0
    lo, hi = -1000.0, 1000.0
    for _ in range(200):
        mid = (lo + hi) / 2.0
        if student_t_cdf(mid, df) < p:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2.0


def _p_for_alternative(t: float, df: float, alternative: str) -> float:
    """p-value for the chosen alternative hypothesis.

    ``greater`` ⇒ H1 the effect is positive (large +t is evidence); ``less`` ⇒
    negative; ``two_sided`` ⇒ either direction.
    """
    if alternative == "two_sided":
        return _t_sf_two_sided(t, df)
    if alternative == "greater":
        return 1.0 - student_t_cdf(t, df)
    if alternative == "less":
        return student_t_cdf(t, df)
    raise ValueError(f"alternative must be one of {_ALTERNATIVES}")


def _ci(centre: float, se: float, df: float, confidence: float) -> tuple[float, float]:
    """Two-sided confidence interval ``centre ± t_crit · se``."""
    if se == 0.0:
        return (round(centre, 4), round(centre, 4))
    t_crit = student_t_ppf(1.0 - (1.0 - confidence) / 2.0, df)
    half = t_crit * se
    return (round(centre - half, 4), round(centre + half, 4))


def _check_confidence(confidence: float) -> None:
    if not 0.0 < confidence < 1.0:
        raise ValueError("confidence must be in (0, 1)")


# ── Results ──────────────────────────────────────────────────────────────────

@dataclass
class OneSampleResult:
    n: int
    mean: float
    std_dev: float
    std_error: float
    mu0: float
    t_statistic: float
    df: float
    p_value: float
    alternative: str
    confidence: float
    ci_low: float
    ci_high: float
    significant: bool


@dataclass
class TwoSampleResult:
    n1: int
    n2: int
    mean1: float
    mean2: float
    std_dev1: float
    std_dev2: float
    mean_diff: float
    t_statistic: float
    df: float
    p_value: float
    alternative: str
    confidence: float
    ci_low: float
    ci_high: float
    significant: bool


def one_sample_t(
    sample: list[float],
    mu0: float,
    *,
    confidence: float = 0.95,
    alternative: str = "two_sided",
) -> OneSampleResult:
    """One-sample t-test of ``sample`` mean against reference ``mu0``.

    Raises ``ValueError`` for fewer than 2 observations (variance undefined).
    """
    _check_confidence(confidence)
    n = len(sample)
    if n < 2:
        raise ValueError("one-sample t-test needs at least 2 observations")

    m = mean(sample)
    s = stdev(sample)  # sample standard deviation (ddof = 1)
    df = float(n - 1)
    se = s / math.sqrt(n)

    if se == 0.0:
        # Degenerate: all values identical. t is 0 when on the mark, else ±inf.
        if m == mu0:
            t, p = 0.0, 1.0
        else:
            t = math.inf if m > mu0 else -math.inf
            p = 0.0 if alternative == "two_sided" else (
                0.0 if (m > mu0) == (alternative == "greater") else 1.0
            )
    else:
        t = (m - mu0) / se
        p = _p_for_alternative(t, df, alternative)

    ci_low, ci_high = _ci(m, se, df, confidence)
    return OneSampleResult(
        n=n,
        mean=round(m, 4),
        std_dev=round(s, 4),
        std_error=round(se, 4),
        mu0=round(mu0, 4),
        t_statistic=t if math.isinf(t) else round(t, 4),
        df=df,
        p_value=round(p, 6),
        alternative=alternative,
        confidence=confidence,
        ci_low=ci_low,
        ci_high=ci_high,
        significant=p < (1.0 - confidence),
    )


def two_sample_welch_t(
    a: list[float],
    b: list[float],
    *,
    confidence: float = 0.95,
    alternative: str = "two_sided",
) -> TwoSampleResult:
    """Welch's two-sample t-test (unequal variances) comparing ``a`` and ``b``.

    ``t`` and the difference are oriented as ``mean(a) − mean(b)``. Raises
    ``ValueError`` if either group has fewer than 2 observations.
    """
    _check_confidence(confidence)
    n1, n2 = len(a), len(b)
    if n1 < 2 or n2 < 2:
        raise ValueError("two-sample t-test needs at least 2 observations per group")

    m1, m2 = mean(a), mean(b)
    s1, s2 = stdev(a), stdev(b)
    v1, v2 = s1 * s1 / n1, s2 * s2 / n2  # squared standard errors
    se = math.sqrt(v1 + v2)
    diff = m1 - m2

    if se == 0.0:
        df = float(n1 + n2 - 2)
        if diff == 0.0:
            t, p = 0.0, 1.0
        else:
            t = math.inf if diff > 0 else -math.inf
            p = 0.0 if alternative == "two_sided" else (
                0.0 if (diff > 0) == (alternative == "greater") else 1.0
            )
    else:
        # Welch–Satterthwaite degrees of freedom.
        df = (v1 + v2) ** 2 / (v1 * v1 / (n1 - 1) + v2 * v2 / (n2 - 1))
        t = diff / se
        p = _p_for_alternative(t, df, alternative)

    ci_low, ci_high = _ci(diff, se, df, confidence)
    return TwoSampleResult(
        n1=n1,
        n2=n2,
        mean1=round(m1, 4),
        mean2=round(m2, 4),
        std_dev1=round(s1, 4),
        std_dev2=round(s2, 4),
        mean_diff=round(diff, 4),
        t_statistic=t if math.isinf(t) else round(t, 4),
        df=round(df, 4),
        p_value=round(p, 6),
        alternative=alternative,
        confidence=confidence,
        ci_low=ci_low,
        ci_high=ci_high,
        significant=p < (1.0 - confidence),
    )
