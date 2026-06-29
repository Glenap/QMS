import React, { useMemo, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Card } from '../../components/ui/Card';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import { useProject } from '../../components/layout/ProjectLayout';
import { KpiStrip } from '../../components/analytics/KpiStrip';
import { useAnalyticsQuality, useSupplierScores, useNcrsBySupplier } from '../../queries/analytics';
import { useProjectTowers } from '../../queries/floors';
import { useGrades } from '../../queries/catalog';
import type { GradeTrendPoint, QualityFilters } from '../../types/master';
import './Analytics.css';

const LINE_COLORS = ['var(--blue)', 'var(--green)', 'var(--amber)', 'var(--red)', '#8b5cf6', '#06b6d4'];

const passRateColor = (rate: number): string =>
  rate >= 90 ? 'var(--green)' : rate >= 85 ? 'var(--amber)' : 'var(--red)';

// Pivot the long-form grade trend ([{period, grade, rate}, …]) into the
// wide shape recharts wants ([{period, M40: 92, M30: 88}, …]) + the grade set.
function pivotTrend(rows: GradeTrendPoint[]): { data: Record<string, number | string>[]; grades: string[] } {
  const grades = [...new Set(rows.map((r) => r.grade_name))].sort();
  const byPeriod = new Map<string, Record<string, number | string>>();
  for (const r of rows) {
    const point = byPeriod.get(r.period) ?? { period: r.period };
    if (r.pass_rate_pct != null) point[r.grade_name] = r.pass_rate_pct;
    byPeriod.set(r.period, point);
  }
  const data = [...byPeriod.values()].sort((a, b) =>
    String(a.period).localeCompare(String(b.period)));
  return { data, grades };
}

export const Analytics: React.FC = () => {
  const { project } = useProject();
  const pid = project.project_id;

  // Dimension filters (apply to the quality charts only).
  const [towerId, setTowerId] = useState('ALL');
  const [gradeId, setGradeId] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const filters = useMemo<QualityFilters>(() => {
    const f: QualityFilters = {};
    if (towerId !== 'ALL') f.tower_id = Number(towerId);
    if (gradeId !== 'ALL') f.grade_id = Number(gradeId);
    if (dateFrom) f.date_from = dateFrom;
    if (dateTo) f.date_to = dateTo;
    return f;
  }, [towerId, gradeId, dateFrom, dateTo]);

  // Every chart on this page is driven by the filters: react-query refetches
  // each query whenever the filters in its key change.
  const { data: suppliers = [] } = useSupplierScores(pid, filters);
  const { data: ncrBySupplier = [] } = useNcrsBySupplier(pid, filters);
  const { data: towers = [] } = useProjectTowers(pid);
  const { data: grades = [] } = useGrades();
  const { data: quality = null } = useAnalyticsQuality(pid, filters);

  const trend = useMemo(() => pivotTrend(quality?.grade_trend ?? []), [quality]);
  const hasQuality = (quality?.grade_trend.length ?? 0) > 0
    || (quality?.strength_distribution.length ?? 0) > 0;

  // KPI strip, derived from the *filtered* data so it tracks the controls
  // (the dashboard shows the same strip whole-project). result_breakdown is on
  // the acceptance basis (one result per cube); avg strength is the test-count-
  // weighted mean of the per-supplier averages.
  const kpiItems = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of quality?.result_breakdown ?? []) counts.set(r.status, r.count);
    const testCount = [...counts.values()].reduce((a, b) => a + b, 0);
    const passCount = counts.get('PASS') ?? 0;
    const failCount = counts.get('FAIL') ?? 0;
    const critCount = counts.get('CRITICAL_FAILURE') ?? 0;
    const passRate = testCount ? Math.round((passCount / testCount) * 1000) / 10 : null;
    const totalPours = suppliers.reduce((a, s) => a + s.pour_count, 0);
    const openNcrs = ncrBySupplier.reduce((a, s) => a + s.open_count, 0);
    const tested = suppliers.filter((s) => s.test_count > 0 && s.avg_strength_mpa != null);
    const testN = tested.reduce((a, s) => a + s.test_count, 0);
    const avgStrength = testN
      ? Math.round((tested.reduce((a, s) => a + (s.avg_strength_mpa as number) * s.test_count, 0) / testN) * 10) / 10
      : null;
    return [
      { label: 'Total Pours', value: totalPours.toLocaleString() },
      { label: 'Pass Rate', value: passRate != null ? `${passRate}%` : '—', color: 'var(--green)' },
      { label: 'Avg. Strength', value: avgStrength != null ? `${avgStrength} MPa` : '—' },
      { label: 'Total Failures', value: String(failCount + critCount), color: 'var(--red)' },
      { label: 'Critical Failures', value: String(critCount), color: 'var(--amber)' },
      { label: 'Open NCRs', value: String(openNcrs) },
    ];
  }, [quality, suppliers, ncrBySupplier]);

  // NCRs by supplier, split by status (open / closed) + severity (critical),
  // worst (most total) first.
  const ncrChart = useMemo(
    () =>
      ncrBySupplier
        .filter((s) => s.total > 0)
        .map((s) => ({
          name: s.supplier_name,
          Open: s.open_count,
          Closed: s.closed_count,
          Critical: s.critical_count,
        }))
        .sort((a, b) => (b.Open + b.Closed) - (a.Open + a.Closed)),
    [ncrBySupplier],
  );

  // Supplier performance = pass rate % (acceptance basis), best first. Honours
  // the same tower / grade / date filters.
  const supplierPerf = useMemo(
    () =>
      suppliers
        .filter((s) => s.test_count > 0)
        .map((s) => ({ name: s.supplier_name, rate: s.pass_rate_pct ?? 0 }))
        .sort((a, b) => b.rate - a.rate),
    [suppliers],
  );

  return (
    <div className="qms-analytics">
      <div className="qms-analytics-header">
        <div>
          <h1 className="qms-page-title-main">Analytics</h1>
          <p className="qms-page-subtitle">Concrete quality performance across towers &amp; suppliers</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <Select
            label="Tower" fullWidth={false} value={towerId}
            onChange={(e) => setTowerId(e.target.value)}
            options={[{ label: 'All towers', value: 'ALL' },
              ...towers.map((t) => ({ label: t.tower_name, value: t.tower_id }))]}
          />
          <Select
            label="Grade" fullWidth={false} value={gradeId}
            onChange={(e) => setGradeId(e.target.value)}
            options={[{ label: 'All grades', value: 'ALL' },
              ...grades.map((g) => ({ label: g.grade_name, value: g.grade_id }))]}
          />
          <Input label="From" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} fullWidth={false} />
          <Input label="To" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} fullWidth={false} />
        </div>
      </div>

      {/* Summary KPI strip — driven by the filters above */}
      <KpiStrip items={kpiItems} />

      {!hasQuality && (
        <Card>
          <p className="text-muted" style={{ fontSize: 14, margin: 0 }}>
            No cube-test data matches the current filters yet. Record strength tests
            (or widen the filters) to populate the quality charts.
          </p>
        </Card>
      )}

      {/* Charts Row 1 — trend + distribution */}
      <div className="qms-an-grid-2">
        <Card>
          <h3 className="qms-chart-heading">Pass Rate Trend by Grade (%)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trend.data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
              <XAxis dataKey="period" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Legend />
              {trend.grades.map((g, i) => (
                <Line key={g} type="monotone" dataKey={g} stroke={LINE_COLORS[i % LINE_COLORS.length]} strokeWidth={2} dot={false} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <h3 className="qms-chart-heading">Strength Distribution (MPa)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={quality?.strength_distribution ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Bar dataKey="count" fill="var(--blue)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* NCRs by supplier — open / closed / critical breakdown */}
      <Card>
        <h3 className="qms-chart-heading">NCRs by RMC Supplier (open · closed · critical)</h3>
        {ncrChart.length === 0 ? (
          <p className="text-muted" style={{ fontSize: 14, margin: 0 }}>
            No NCRs raised yet — no supplier has a failed cube test.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={ncrChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Open" name="Open" fill="var(--amber)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Closed" name="Closed" fill="var(--green)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Critical" name="Critical" fill="var(--red)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Supplier performance comparison (pass rate %) — last on the page */}
      <Card>
        <h3 className="qms-chart-heading">Supplier Performance Comparison (pass rate %)</h3>
        {supplierPerf.length === 0 ? (
          <p className="text-muted" style={{ fontSize: 14, margin: 0 }}>
            {suppliers.length === 0
              ? 'No suppliers have poured on this project yet.'
              : 'No cube tests match the current filters.'}
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={supplierPerf}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Bar dataKey="rate" name="Pass rate %" radius={[4, 4, 0, 0]}>
                {supplierPerf.map((s, i) => (
                  <Cell key={i} fill={passRateColor(s.rate)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
};
