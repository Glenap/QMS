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
from dataclasses import dataclass, field
from statistics import NormalDist, mean, median, quantiles, stdev

__all__ = [
    "GraphicalSummaryResult",
    "OneSampleResult",
    "OutlierPoint",
    "ThompsonOutliersResult",
    "TwoSampleResult",
    "graphical_summary",
    "modified_thompson_outliers",
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


# ── Graphical summary (Minitab-style descriptive report) ─────────────────────
#
# One filtered strength dataset → the whole descriptive picture: moments,
# quartiles, the Anderson–Darling normality test, a t-based CI for the mean, and
# the curve data the front end overlays (histogram, fitted normal PDF, Gaussian
# KDE, and normal-probability-plot points). No numpy/scipy — same house rule.

_LOG_EPS = 1e-12  # clamp for the CDF terms in Anderson–Darling (avoid log 0)


@dataclass
class GraphicalSummaryResult:
    n: int
    mean: float
    std_dev: float          # sample standard deviation (ddof = 1)
    variance: float         # sample variance
    skewness: float         # Fisher (population) moment estimate
    kurtosis: float         # excess kurtosis (0 for a normal)
    minimum: float
    q1: float
    median: float
    q3: float
    maximum: float
    confidence: float
    ci_mean_low: float
    ci_mean_high: float
    # Anderson–Darling normality; None when σ = 0 (degenerate, test undefined).
    ad_statistic: float | None
    ad_p_value: float | None
    is_normal: bool | None
    bin_width: float
    # Curve data for the front end. histogram: (bin_low, bin_high, count);
    # fit/kde: (x, density); prob_points: (ordered value, theoretical quantile).
    histogram: list[tuple[float, float, int]] = field(default_factory=list)
    fit_curve: list[tuple[float, float]] = field(default_factory=list)
    kde_curve: list[tuple[float, float]] = field(default_factory=list)
    prob_points: list[tuple[float, float]] = field(default_factory=list)


def _anderson_darling_normal(
    ordered: list[float], mu: float, sd: float
) -> tuple[float, float, bool] | None:
    """Anderson–Darling test for normality with estimated μ, σ.

    Returns ``(A²*, p_value, is_normal)`` — the small-sample-adjusted statistic
    and its p-value via the D'Agostino & Stephens (1986) approximation — or
    ``None`` when σ = 0 (the test is undefined). ``is_normal`` is ``p > 0.05``.
    """
    n = len(ordered)
    if sd <= 0.0 or n < 2:
        return None
    std_normal = NormalDist()
    total = 0.0
    for i, x in enumerate(ordered):
        cdf_i = std_normal.cdf((x - mu) / sd)
        cdf_rev = std_normal.cdf((ordered[n - 1 - i] - mu) / sd)
        cdf_i = min(max(cdf_i, _LOG_EPS), 1.0 - _LOG_EPS)
        cdf_rev = min(max(cdf_rev, _LOG_EPS), 1.0 - _LOG_EPS)
        total += (2 * (i + 1) - 1) * (math.log(cdf_i) + math.log(1.0 - cdf_rev))
    a2 = -n - total / n
    a2_star = a2 * (1.0 + 0.75 / n + 2.25 / (n * n))
    if a2_star >= 0.6:
        p = math.exp(1.2937 - 5.709 * a2_star + 0.0186 * a2_star**2)
    elif a2_star >= 0.34:
        p = math.exp(0.9177 - 4.279 * a2_star - 1.38 * a2_star**2)
    elif a2_star >= 0.2:
        p = 1.0 - math.exp(-8.318 + 42.796 * a2_star - 59.938 * a2_star**2)
    else:
        p = 1.0 - math.exp(-13.436 + 101.14 * a2_star - 223.73 * a2_star**2)
    p = min(max(p, 0.0), 1.0)
    return round(a2_star, 4), round(p, 6), p > 0.05


def _histogram(ordered: list[float], bins: int) -> tuple[list[tuple[float, float, int]], float]:
    """Equal-width histogram of sorted ``ordered`` → ``(bars, bin_width)``."""
    lo, hi = ordered[0], ordered[-1]
    if hi <= lo:
        hi = lo + 1.0
    width = (hi - lo) / bins
    counts = [0] * bins
    for x in ordered:
        idx = int((x - lo) / width)
        counts[min(idx, bins - 1)] += 1
    bars = [
        (round(lo + i * width, 2), round(lo + (i + 1) * width, 2), counts[i])
        for i in range(bins)
    ]
    return bars, width


def histogram_buckets(
    sample: list[float], *, bins: int = 6
) -> list[tuple[float, float, int]]:
    """Equal-width histogram over the sample's own range → ``(lo, hi, count)``.

    Public wrapper over the same binning ``graphical_summary`` uses, so the
    quality dashboard's strength distribution and the graphical summary agree on
    where the bars fall.
    """
    if not sample:
        return []
    bars, _ = _histogram(sorted(float(x) for x in sample), bins)
    return bars


def graphical_summary(
    sample: list[float], *, confidence: float = 0.95, curve_points: int = 61
) -> GraphicalSummaryResult:
    """Full descriptive summary of a strength dataset (Minitab graphical summary).

    Raises ``ValueError`` for fewer than 2 observations (variance undefined).
    """
    _check_confidence(confidence)
    n = len(sample)
    if n < 2:
        raise ValueError("graphical summary needs at least 2 observations")

    ordered = sorted(float(x) for x in sample)
    mu = mean(ordered)
    sd = stdev(ordered)                        # sample SD (ddof = 1)
    var = sd * sd
    # Central moments (population/biased) for skewness & excess kurtosis.
    m2 = sum((x - mu) ** 2 for x in ordered) / n
    m3 = sum((x - mu) ** 3 for x in ordered) / n
    m4 = sum((x - mu) ** 4 for x in ordered) / n
    skew = m3 / m2**1.5 if m2 > 0 else 0.0
    kurt = (m4 / (m2 * m2) - 3.0) if m2 > 0 else 0.0
    med = median(ordered)
    if n >= 4:
        q1, _, q3 = quantiles(ordered, n=4, method="inclusive")
    else:
        q1, q3 = ordered[0], ordered[-1]

    # t-based two-sided CI for the mean.
    ci_low, ci_high = _ci(mu, sd / math.sqrt(n), float(n - 1), confidence)

    ad = _anderson_darling_normal(ordered, mu, sd)
    ad_stat, ad_p, is_normal = ad if ad is not None else (None, None, None)

    bins = max(5, min(15, round(math.sqrt(n))))
    histogram, bin_width = _histogram(ordered, bins)

    fit_curve: list[tuple[float, float]] = []
    kde_curve: list[tuple[float, float]] = []
    prob_points: list[tuple[float, float]] = []
    if sd > 0:
        lo = ordered[0] - 0.5 * sd
        hi = ordered[-1] + 0.5 * sd
        step = (hi - lo) / (curve_points - 1)
        h = 1.06 * sd * n ** (-0.2)            # Silverman bandwidth for the KDE
        kde_norm = 1.0 / (n * h * math.sqrt(2 * math.pi))
        pdf_norm = 1.0 / (sd * math.sqrt(2 * math.pi))
        for k in range(curve_points):
            x = lo + k * step
            fit_curve.append(
                (round(x, 2), round(pdf_norm * math.exp(-((x - mu) ** 2) / (2 * var)), 6))
            )
            kde_curve.append(
                (
                    round(x, 2),
                    round(kde_norm * sum(math.exp(-0.5 * ((x - xi) / h) ** 2) for xi in ordered), 6),
                )
            )
        dist = NormalDist(mu, sd)
        for i, x in enumerate(ordered):
            # Blom plotting position → theoretical normal quantile (Q–Q plot).
            theo = dist.inv_cdf((i + 1 - 0.375) / (n + 0.25))
            prob_points.append((round(x, 2), round(theo, 2)))

    return GraphicalSummaryResult(
        n=n,
        mean=round(mu, 3),
        std_dev=round(sd, 3),
        variance=round(var, 3),
        skewness=round(skew, 4),
        kurtosis=round(kurt, 4),
        minimum=round(ordered[0], 2),
        q1=round(q1, 2),
        median=round(med, 2),
        q3=round(q3, 2),
        maximum=round(ordered[-1], 2),
        confidence=confidence,
        ci_mean_low=ci_low,
        ci_mean_high=ci_high,
        ad_statistic=ad_stat,
        ad_p_value=ad_p,
        is_normal=is_normal,
        bin_width=round(bin_width, 3),
        histogram=histogram,
        fit_curve=fit_curve,
        kde_curve=kde_curve,
        prob_points=prob_points,
    )


# ── Outlier detection (modified Thompson τ) ──────────────────────────────────
#
# Cimbala (Penn State), "Outliers", modified Thompson τ technique for a single
# variable: reject the most-suspect point when its deviation exceeds τ·S, where
#   τ = t_{α/2}·(n−1) / (√n · √(n−2 + t_{α/2}²)),  α = 0.05, df = n−2,
# then recompute mean/S on the survivors and repeat one point at a time until no
# further point is rejected. t_{α/2} is the two-tailed 5% critical value =
# student_t_ppf(0.975, n−2).


@dataclass
class OutlierPoint:
    value: float
    is_outlier: bool


@dataclass
class ThompsonOutliersResult:
    n: int
    mean: float               # of the full sample
    std_dev: float            # of the full sample (ddof = 1)
    outlier_count: int
    clean_mean: float         # after removing the outliers
    clean_std_dev: float
    tau: float                # τ for the first (full-sample) iteration
    threshold: float          # τ·S — the first-iteration rejection distance
    points: list[OutlierPoint]  # in input order (chronological)
    outliers: list[float]       # rejected values, ascending


def modified_thompson_outliers(sample: list[float]) -> ThompsonOutliersResult:
    """Flag statistical outliers in a single-variable sample (Thompson τ).

    Points are returned in input order with an ``is_outlier`` flag. With fewer
    than 3 points the test is undefined, so none are flagged.
    """
    values = [float(x) for x in sample]
    n0 = len(values)
    full_mean = round(mean(values), 3) if n0 >= 1 else 0.0
    full_std = round(stdev(values), 3) if n0 >= 2 else 0.0

    outlier_idx: set[int] = set()
    tau0 = 0.0
    threshold0 = 0.0
    remaining = list(enumerate(values))  # (original_index, value)
    first = True
    while len(remaining) >= 3:
        rvals = [v for _, v in remaining]
        m = mean(rvals)
        s = stdev(rvals)
        if s == 0.0:
            break
        n = len(rvals)
        t_a2 = student_t_ppf(0.975, n - 2)  # two-tailed α = 0.05, df = n−2
        tau = t_a2 * (n - 1) / (math.sqrt(n) * math.sqrt(n - 2 + t_a2 * t_a2))
        threshold = tau * s
        # The most-suspect point: the largest absolute deviation from the mean.
        pos, (oidx, oval) = max(enumerate(remaining), key=lambda kv: abs(kv[1][1] - m))
        if first:
            tau0, threshold0, first = round(tau, 4), round(threshold, 3), False
        if abs(oval - m) > threshold:
            outlier_idx.add(oidx)
            remaining.pop(pos)
        else:
            break

    clean = [v for i, v in enumerate(values) if i not in outlier_idx]
    clean_mean = round(mean(clean), 3) if len(clean) >= 1 else 0.0
    clean_std = round(stdev(clean), 3) if len(clean) >= 2 else 0.0

    return ThompsonOutliersResult(
        n=n0,
        mean=full_mean,
        std_dev=full_std,
        outlier_count=len(outlier_idx),
        clean_mean=clean_mean,
        clean_std_dev=clean_std,
        tau=tau0,
        threshold=threshold0,
        points=[OutlierPoint(round(v, 2), i in outlier_idx) for i, v in enumerate(values)],
        outliers=sorted(round(values[i], 2) for i in outlier_idx),
    )
