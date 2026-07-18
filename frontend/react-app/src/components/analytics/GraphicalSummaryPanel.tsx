// Graphical summary — a Minitab-style descriptive report for one filtered cube
// strength dataset: histogram with a fitted normal PDF + Gaussian KDE overlay, a
// normal probability (Q–Q) plot, and a panel of descriptive stats with the
// Anderson–Darling normality test and a 95% CI for the mean. Every number comes
// from the backend (/analytics/graphical-summary); the frontend only lays it out.
// See backend/app/core/statistics.py:graphical_summary.

import React, { forwardRef, useState } from 'react';
import {
  Bar, CartesianGrid, ComposedChart, Line, ReferenceLine,
  ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Card } from '../ui/Card';
import { Select } from '../ui/Select';
import { DateRangeFilter } from './DateRangeFilter';
import { presetRange, type DatePreset } from './dateRange';
import { useGraphicalSummary } from '../../queries/analytics';

type Opt = { label: string; value: string | number };

interface Props {
  pid: number;
  gradeOpts: Opt[];
  towerOpts: Opt[];
  contractorOpts: Opt[];
  firstGrade: string;
  firstTower: string;
  tid: (v: string) => number | undefined;
  clause?: React.ReactNode; // code-clause citation shown under the heading
}

const num = (v: string): number | undefined => (v ? Number(v) : undefined);
const fmt = (x: number | null | undefined, dp = 2): string =>
  x == null ? '—' : x.toLocaleString(undefined, { maximumFractionDigits: dp });

const filterRow: React.CSSProperties = {
  display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 12,
};

const intTick = (v: number | string): string => String(Math.round(Number(v)));

export const GraphicalSummaryPanel = forwardRef<HTMLDivElement, Props>(function GraphicalSummaryPanel(
  { pid, gradeOpts, towerOpts, contractorOpts, firstGrade, firstTower, tid, clause }, ref,
) {
  const [g, setG] = useState('');
  const [t, setT] = useState('');
  const [c, setC] = useState('ALL');
  const [conf, setConf] = useState('0.95'); // CI confidence level
  const [preset, setPreset] = useState<DatePreset>('7');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const grade = g || firstGrade;
  const tower = t || firstTower;
  const range = presetRange(preset, from, to);

  const { data } = useGraphicalSummary(pid, {
    grade_id: num(grade), tower_id: tid(tower),
    contractor_id: c !== 'ALL' ? Number(c) : undefined,
    date_from: range.date_from, date_to: range.date_to,
  }, Number(conf));

  const hasStats = data != null && data.mean != null && data.histogram.length > 0;

  // Overlay the fitted normal + KDE densities on the frequency histogram by
  // scaling density → expected count (density · N · bin_width).
  const scale = hasStats ? data!.sample_count * (data!.bin_width ?? 1) : 1;
  const chartRows = hasStats
    ? [
        ...data!.histogram.map((b) => ({ x: (b.bin_low + b.bin_high) / 2, count: b.count })),
        ...data!.fit_curve.map((p, i) => ({
          x: p.x, fit: p.y * scale, kde: (data!.kde_curve[i]?.y ?? 0) * scale,
        })),
      ].sort((a, b) => a.x - b.x)
    : [];

  const qq = hasStats ? data!.prob_points.map((p) => ({ x: p.value, y: p.theoretical })) : [];
  const qqLo = qq.length ? Math.min(...qq.map((p) => Math.min(p.x, p.y))) : 0;
  const qqHi = qq.length ? Math.max(...qq.map((p) => Math.max(p.x, p.y))) : 1;

  return (
    <div ref={ref}>
      <Card>
        <h3 className="qms-chart-heading">
          Graphical summary
          {data?.grade_name ? ` · ${data.grade_name}` : ''}
          {hasStats ? ` (n ${data!.sample_count})` : ''}
        </h3>
        {clause && <div className="qms-clause-block">{clause}</div>}
        <p className="qms-chart-sub">
          Distribution shape, normality and dispersion of cube strengths — histogram with a fitted
          normal curve and kernel density, a normal probability plot, and the Anderson–Darling test
          for normality.
        </p>

        <div style={filterRow}>
          <Select label="Grade" fullWidth={false} value={grade} onChange={(e) => setG(e.target.value)} options={gradeOpts} />
          <Select label="Tower" fullWidth={false} value={tower} onChange={(e) => setT(e.target.value)} options={towerOpts} />
          {contractorOpts.length > 0 && (
            <Select label="Contractor" fullWidth={false} value={c} onChange={(e) => setC(e.target.value)}
              options={[{ label: 'All contractors', value: 'ALL' }, ...contractorOpts]} />
          )}
          <Select label="Confidence" fullWidth={false} value={conf} onChange={(e) => setConf(e.target.value)}
            options={[
              { label: '90%', value: '0.90' },
              { label: '95%', value: '0.95' },
              { label: '99%', value: '0.99' },
              { label: '99.9%', value: '0.999' },
            ]} />
          <DateRangeFilter preset={preset} from={from} to={to} onPreset={setPreset} onFrom={setFrom} onTo={setTo} />
        </div>

        {!hasStats ? (
          <p className="text-muted" style={{ fontSize: 14, margin: 0 }}>
            Need at least two cube results for this selection to build the summary.
          </p>
        ) : (
          <>
            {data!.std_dev === 0 && (
              <div className="qms-gs-alert">
                <strong>⚠ Zero variance — all {data!.sample_count} results are identical.</strong> Independent
                physical cube tests should never produce an exactly constant strength; this pattern is a strong
                sign the values were copied or fabricated rather than measured. Investigate before accepting.
              </div>
            )}
          <div className="qms-gs-grid">
            {/* Left: the two plots */}
            <div className="qms-gs-plots">
              <div className="qms-gs-plot">
                <div className="qms-gs-plot-title">Histogram · fitted normal &amp; KDE</div>
                <div className="qms-gs-plot-body">
                <ResponsiveContainer width="100%" height="100%" minHeight={220}>
                  <ComposedChart data={chartRows} margin={{ top: 16, right: 12, bottom: 16, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                    <XAxis dataKey="x" type="number" domain={['dataMin', 'dataMax']} tick={{ fontSize: 11 }}
                      axisLine={false} tickLine={false} tickFormatter={intTick} interval="preserveStartEnd" minTickGap={28}
                      height={42} label={{ value: 'Strength (MPa)', position: 'insideBottom', fontSize: 11, fill: 'var(--gray-500)' }} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} width={34}
                      label={{ value: 'frequency', angle: -90, position: 'insideLeft', fontSize: 11, fill: 'var(--gray-500)' }} />
                    <Tooltip
                      formatter={(v, name) =>
                        name === 'count' ? [v, 'count'] : [Number(v).toFixed(2), name === 'fit' ? 'normal' : 'KDE']}
                      labelFormatter={(x) => `${Number(x).toFixed(1)} MPa`} />
                    <Bar dataKey="count" name="count" fill="var(--blue)" fillOpacity={0.22}
                      stroke="var(--blue)" strokeOpacity={0.35} strokeWidth={1} barSize={26} maxBarSize={40} isAnimationActive={false} />
                    <Line dataKey="fit" name="fit" type="monotone" dot={false} connectNulls
                      stroke="var(--blue)" strokeWidth={1.5} isAnimationActive={false} />
                    <Line dataKey="kde" name="kde" type="monotone" dot={false} connectNulls
                      stroke="var(--amber, #d97706)" strokeWidth={1.5} strokeDasharray="5 3" isAnimationActive={false} />
                    {data!.mean != null && (
                      <ReferenceLine x={data!.mean} stroke="var(--green)" strokeDasharray="4 4"
                        label={{ value: 'X̄', position: 'top', fontSize: 11, fill: 'var(--green)' }} />
                    )}
                    {data!.fck != null && (
                      <ReferenceLine x={data!.fck} stroke="var(--red)" strokeDasharray="4 4"
                        label={{ value: `fck ${data!.fck}`, position: 'top', fontSize: 11, fill: 'var(--red)' }} />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
                </div>
                <p className="qms-chart-hint" style={{ marginTop: 10 }}>
                  Bars = how many results fall in each strength band. The solid curve is the best-fit
                  normal; the dashed curve is the data&apos;s actual shape (kernel density).
                </p>
              </div>

              <div className="qms-gs-plot">
                <div className="qms-gs-plot-title">Normal probability plot (Q–Q)</div>
                <div className="qms-gs-plot-body">
                <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                  <ScatterChart margin={{ top: 8, right: 12, bottom: 16, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                    <XAxis type="number" dataKey="x" name="observed" domain={[qqLo, qqHi]} tick={{ fontSize: 11 }}
                      axisLine={false} tickLine={false} tickFormatter={intTick} minTickGap={28} height={42}
                      label={{ value: 'Observed (MPa)', position: 'insideBottom', fontSize: 11, fill: 'var(--gray-500)' }} />
                    <YAxis type="number" dataKey="y" name="theoretical" domain={[qqLo, qqHi]} tick={{ fontSize: 11 }}
                      axisLine={false} tickLine={false} tickFormatter={intTick} width={34}
                      label={{ value: 'expected', angle: -90, position: 'insideLeft', fontSize: 11, fill: 'var(--gray-500)' }} />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }}
                      formatter={(v) => `${Number(v).toFixed(1)} MPa`} />
                    <ReferenceLine segment={[{ x: qqLo, y: qqLo }, { x: qqHi, y: qqHi }]}
                      stroke="var(--gray-400)" strokeDasharray="4 4" />
                    <Scatter data={qq} fill="var(--blue)" isAnimationActive={false} />
                  </ScatterChart>
                </ResponsiveContainer>
                </div>
                <p className="qms-chart-hint" style={{ marginTop: 10, textAlign: 'center' }}>
                  Points on the diagonal ⇒ strengths follow a normal distribution.
                </p>
              </div>
            </div>

            {/* Right: descriptive statistics */}
            <div className="qms-gs-stats">
              <div className="qms-gs-stats-title">Descriptive statistics</div>
              <dl className="qms-gs-dl">
                <dt>N</dt><dd>{data!.sample_count}</dd>
                <dt>Mean</dt><dd>{fmt(data!.mean)} MPa</dd>
                <dt>StDev</dt><dd>{fmt(data!.std_dev)}</dd>
                <dt>Variance</dt><dd>{fmt(data!.variance)}</dd>
                <dt>Skewness</dt><dd>{fmt(data!.skewness, 3)}</dd>
                <dt>Kurtosis</dt><dd>{fmt(data!.kurtosis, 3)}</dd>
                <dt>Minimum</dt><dd>{fmt(data!.minimum)}</dd>
                <dt>1st quartile</dt><dd>{fmt(data!.q1)}</dd>
                <dt>Median</dt><dd>{fmt(data!.median)}</dd>
                <dt>3rd quartile</dt><dd>{fmt(data!.q3)}</dd>
                <dt>Maximum</dt><dd>{fmt(data!.maximum)}</dd>
              </dl>

              <div className="qms-gs-stats-title">Anderson–Darling normality</div>
              {data!.ad_statistic == null ? (
                <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>Not available (zero variance).</p>
              ) : (
                <>
                  <dl className="qms-gs-dl">
                    <dt>A²</dt><dd>{fmt(data!.ad_statistic, 3)}</dd>
                    <dt>p-value</dt><dd>{data!.ad_p_value! < 0.005 ? '< 0.005' : fmt(data!.ad_p_value, 3)}</dd>
                  </dl>
                  <span className={`qms-gs-verdict ${data!.is_normal ? 'is-ok' : 'is-warn'}`}>
                    {data!.is_normal ? 'Data appears normal (p > 0.05)' : 'Departs from normal (p ≤ 0.05)'}
                  </span>
                  <p className="qms-gs-help">
                    <strong>A²</strong> measures how far the results stray from a bell curve — bigger means a
                    worse fit. <strong>p</strong> is the chance of seeing that much departure if the strengths
                    were truly normal: <strong>p &gt; 0.05</strong> is consistent with normal, while
                    <strong> p ≤ 0.05</strong> flags a real departure (heavy skew, clustering, or repeated/
                    fabricated values).
                  </p>
                </>
              )}

              <div className="qms-gs-stats-title">
                {((data!.ci_confidence ?? 0.95) * 100).toFixed(1).replace(/\.0$/, '')}% CI for the mean
              </div>
              <div className="qms-gs-ci">
                {fmt(data!.ci_mean_low)} &nbsp;–&nbsp; {fmt(data!.ci_mean_high)} MPa
              </div>
            </div>
          </div>
          </>
        )}
      </Card>
    </div>
  );
});
