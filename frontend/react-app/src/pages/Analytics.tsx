import React, { useEffect, useMemo, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Card } from '../components/ui/Card';
import { Select } from '../components/ui/Select';
import { Input } from '../components/ui/Input';
import { useProject } from '../components/layout/ProjectLayout';
import { analyticsApi } from '../api/analytics';
import { catalogApi } from '../api/catalog';
import { projectsApi } from '../api/projects';
import type {
  GradeResponse, GradeTrendPoint, OverviewKpis,
  QualityAnalytics, QualityFilters, SupplierScore, TowerResponse,
} from '../types/master';
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

const Kpi: React.FC<{ value: string; label: string; color?: string }> = ({ value, label, color }) => (
  <div className="qms-an-kpi">
    <div className="qms-an-kpi-val" style={color ? { color } : undefined}>{value}</div>
    <div className="qms-an-kpi-label">{label}</div>
  </div>
);

export const Analytics: React.FC = () => {
  const { project } = useProject();
  const pid = project.project_id;

  const [kpis, setKpis] = useState<OverviewKpis | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierScore[]>([]);
  const [quality, setQuality] = useState<QualityAnalytics | null>(null);
  const [towers, setTowers] = useState<TowerResponse[]>([]);
  const [grades, setGrades] = useState<GradeResponse[]>([]);

  // Dimension filters (apply to the quality charts only).
  const [towerId, setTowerId] = useState('ALL');
  const [gradeId, setGradeId] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Whole-project context: KPIs, supplier scorecard, filter option lists.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [o, s, t, g] = await Promise.all([
        analyticsApi.overview(pid).catch(() => null),
        analyticsApi.suppliers(pid).catch(() => []),
        projectsApi.towers(pid).catch(() => []),
        catalogApi.grades().catch(() => []),
      ]);
      if (cancelled) return;
      setKpis(o); setSuppliers(s); setTowers(t); setGrades(g);
    })();
    return () => { cancelled = true; };
  }, [pid]);

  // Quality charts re-fetch whenever a filter changes.
  useEffect(() => {
    let cancelled = false;
    const filters: QualityFilters = {};
    if (towerId !== 'ALL') filters.tower_id = Number(towerId);
    if (gradeId !== 'ALL') filters.grade_id = Number(gradeId);
    if (dateFrom) filters.date_from = dateFrom;
    if (dateTo) filters.date_to = dateTo;
    (async () => {
      const q = await analyticsApi.quality(pid, filters).catch(() => null);
      if (!cancelled) setQuality(q);
    })();
    return () => { cancelled = true; };
  }, [pid, towerId, gradeId, dateFrom, dateTo]);

  const trend = useMemo(() => pivotTrend(quality?.grade_trend ?? []), [quality]);
  const failures = kpis ? kpis.fail_count + kpis.critical_count : null;
  const hasQuality = (quality?.grade_trend.length ?? 0) > 0
    || (quality?.strength_distribution.length ?? 0) > 0;

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

      {/* Summary KPI strip (whole project) */}
      <div className="qms-an-kpi-row">
        <Kpi value={kpis ? kpis.pour_count.toLocaleString() : '—'} label="Total Pours" />
        <Kpi value={kpis?.pass_rate_pct != null ? `${kpis.pass_rate_pct}%` : '—'} label="Overall Pass Rate" color="var(--green)" />
        <Kpi value={kpis?.avg_strength_mpa != null ? `${kpis.avg_strength_mpa} MPa` : '—'} label="Avg. Strength" />
        <Kpi value={failures != null ? String(failures) : '—'} label="Total Failures" color="var(--red)" />
        <Kpi value={kpis ? String(kpis.critical_count) : '—'} label="Critical Failures" color="var(--amber)" />
        <Kpi value={kpis ? String(kpis.ncr_open) : '—'} label="Open NCRs" />
      </div>

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

      {/* Charts Row 2 — supplier scorecard */}
      <Card>
        <h3 className="qms-chart-heading">Supplier Performance Comparison</h3>
        {suppliers.length === 0 ? (
          <p className="text-muted" style={{ fontSize: 14, margin: 0 }}>No suppliers have poured on this project yet.</p>
        ) : (
          <div className="qms-supplier-table">
            <div className="qms-sup-head">
              <span>Supplier</span><span>Pours</span><span>Pass Rate</span><span>Avg MPa</span><span>Trend</span>
            </div>
            {suppliers.map((s) => {
              const rate = s.pass_rate_pct ?? 0;
              return (
                <div key={s.supplier_id} className="qms-sup-row">
                  <span className="font-medium">{s.supplier_name}</span>
                  <span>{s.pour_count}</span>
                  <span style={{ color: passRateColor(rate), fontWeight: 600 }}>
                    {s.pass_rate_pct != null ? `${s.pass_rate_pct}%` : '—'}
                  </span>
                  <span>{s.avg_strength_mpa ?? '—'}</span>
                  <div className="qms-mini-bar">
                    <div className="qms-mini-bar-fill" style={{ width: `${rate}%`, background: passRateColor(rate) }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};
