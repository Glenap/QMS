// Statistical tests (Student's t) for the Analytics page. Two panels:
//   • one-sample — is a selection's mean cube strength significantly above /
//     below / different from a reference (fck, target mean, or a custom value)?
//   • two-sample (Welch) — do two selections differ significantly?
// The confidence level (default 95%) is shared and user-adjustable; the maths
// runs on the backend (app/core/statistics.py) — this is presentation only.

import React, { useMemo, useState } from 'react';
import {
  CartesianGrid, ReferenceArea, ReferenceLine, ResponsiveContainer,
  Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Card } from '../ui/Card';
import { Select } from '../ui/Select';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { getApiErrorMessage } from '../../api/client';
import { useOneSampleTTest, useTwoSampleTTest } from '../../queries/analytics';
import { useGrades } from '../../queries/catalog';
import { useProjectTowers } from '../../queries/floors';
import { useSuppliers } from '../../queries/suppliers';
import type {
  Alternative,
  GroupFilter,
  OneSampleTTest,
  TTestBasis,
  TwoSampleTTest,
} from '../../types/master';

const filterRow: React.CSSProperties = { display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 12 };
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginTop: 12 };

const CONF_OPTS = [{ label: '90%', value: '90' }, { label: '95%', value: '95' }, { label: '99%', value: '99' }];

const fmtP = (p: number) => (p < 0.0001 ? '< 0.0001' : p.toFixed(4));
const fmt = (v: number | null | undefined, dp = 2) => (v == null ? '—' : v.toFixed(dp));

const Stat: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div>
    <div style={{ fontSize: 11, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--gray-900)' }}>{value}</div>
  </div>
);

const Verdict: React.FC<{ significant: boolean; text: string }> = ({ significant, text }) => (
  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 4 }}>
    <Badge variant={significant ? 'info' : 'default'}>{significant ? 'Significant' : 'Not significant'}</Badge>
    <span style={{ fontSize: 14, color: 'var(--gray-700)', lineHeight: 1.45 }}>{text}</span>
  </div>
);

const GROUP_B_COLOR = '#7C3AED';

const padded = (vals: number[]): [number, number] => {
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const pad = (hi - lo) * 0.12 || 1;
  return [Math.floor(lo - pad), Math.ceil(hi + pad)];
};

// One-sample: each observed strength as a point, with the reference µ₀ (red),
// the sample mean (blue) and the confidence-interval band shaded.
const OneSampleChart: React.FC<{ d: OneSampleTTest }> = ({ d }) => {
  const points = d.values.map((v, i) => ({ x: i + 1, y: v }));
  const [lo, hi] = padded([...d.values, d.mu0, d.ci_low, d.ci_high]);
  return (
    <ResponsiveContainer width="100%" height={200}>
      <ScatterChart margin={{ top: 10, right: 18, bottom: 6, left: -6 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
        <XAxis type="number" dataKey="x" domain={[0.5, points.length + 0.5]} tick={false} axisLine={false} tickLine={false}
          label={{ value: `${d.sample_count} cube results`, position: 'insideBottom', fontSize: 11, offset: -2 }} />
        <YAxis type="number" dataKey="y" domain={[lo, hi]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} unit=" MPa" width={54} />
        <Tooltip formatter={(v) => [`${v} MPa`, 'strength']} labelFormatter={() => ''} />
        <ReferenceArea y1={d.ci_low} y2={d.ci_high} fill="var(--blue)" fillOpacity={0.08} />
        <ReferenceLine y={d.mu0} stroke="var(--red)" strokeDasharray="5 4"
          label={{ value: `µ₀ ${d.mu0}`, fontSize: 11, fill: 'var(--red)', position: 'insideTopRight' }} />
        <ReferenceLine y={d.mean} stroke="var(--blue)"
          label={{ value: `mean ${d.mean}`, fontSize: 11, fill: 'var(--blue)', position: 'insideBottomRight' }} />
        <Scatter data={points} fill="var(--blue)" />
      </ScatterChart>
    </ResponsiveContainer>
  );
};

// Two-sample: the two groups as separate columns of points with their means.
const TwoSampleChart: React.FC<{ r: TwoSampleTTest }> = ({ r }) => {
  const spread = (vals: number[], centre: number) =>
    vals.map((v, i) => ({ x: centre + (i - (vals.length - 1) / 2) * 0.08, y: v }));
  const aPts = spread(r.group_a.values, 1);
  const bPts = spread(r.group_b.values, 2);
  const [lo, hi] = padded([...r.group_a.values, ...r.group_b.values]);
  const short = (s: string) => (s.length > 16 ? `${s.slice(0, 15)}…` : s);
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ScatterChart margin={{ top: 10, right: 18, bottom: 6, left: -6 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
        <XAxis type="number" dataKey="x" domain={[0.4, 2.6]} ticks={[1, 2]}
          tickFormatter={(t) => (t === 1 ? short(r.group_a.label) : t === 2 ? short(r.group_b.label) : '')}
          tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis type="number" dataKey="y" domain={[lo, hi]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} unit=" MPa" width={54} />
        <Tooltip formatter={(v) => [`${v} MPa`, 'strength']} labelFormatter={() => ''} />
        {r.group_a.mean != null && <ReferenceLine y={r.group_a.mean} stroke="var(--blue)" strokeDasharray="4 4" />}
        {r.group_b.mean != null && <ReferenceLine y={r.group_b.mean} stroke={GROUP_B_COLOR} strokeDasharray="4 4" />}
        <Scatter name={r.group_a.label} data={aPts} fill="var(--blue)" />
        <Scatter name={r.group_b.label} data={bPts} fill={GROUP_B_COLOR} />
      </ScatterChart>
    </ResponsiveContainer>
  );
};

// ── One-sample panel ─────────────────────────────────────────────────────────

const OneSamplePanel: React.FC<{ pid: number; confidence: number }> = ({ pid, confidence }) => {
  const { data: grades = [] } = useGrades();
  const { data: towers = [] } = useProjectTowers(pid);

  const [grade, setGrade] = useState('');
  const [tower, setTower] = useState('');
  const [basis, setBasis] = useState<TTestBasis>('fck');
  const [mu0, setMu0] = useState('');
  const [alt, setAlt] = useState<Alternative>('greater');

  const needsGrade = basis === 'fck' || basis === 'target';
  const enabled = needsGrade ? grade !== '' : mu0 !== '';

  const params = {
    grade_id: grade ? Number(grade) : undefined,
    tower_id: tower ? Number(tower) : undefined,
    basis,
    mu0: basis === 'custom' && mu0 !== '' ? Number(mu0) : undefined,
    alternative: alt,
    confidence,
  };
  const { data, error, isFetching } = useOneSampleTTest(pid, params, enabled) as {
    data?: OneSampleTTest; error: unknown; isFetching: boolean;
  };

  const gradeOpts = [{ label: 'Select grade…', value: '' }, ...grades.map((g) => ({ label: g.grade_name, value: g.grade_id }))];
  const towerOpts = [{ label: 'All towers', value: '' }, ...towers.map((t) => ({ label: t.tower_name, value: t.tower_id }))];

  return (
    <Card>
      <h3 className="qms-chart-heading">Does the concrete meet spec? (one-sample t-test)</h3>
      <div style={filterRow}>
        <Select label="Grade" fullWidth={false} value={grade} onChange={(e) => setGrade(e.target.value)} options={gradeOpts} />
        <Select label="Compare against" fullWidth={false} value={basis} onChange={(e) => setBasis(e.target.value as TTestBasis)}
          options={[
            { label: 'Characteristic strength (fck)', value: 'fck' },
            { label: 'Target mean strength', value: 'target' },
            { label: 'Custom value', value: 'custom' },
          ]} />
        {basis === 'custom' && (
          <Input label="Reference (MPa)" type="number" step="0.1" fullWidth={false} value={mu0} onChange={(e) => setMu0(e.target.value)} style={{ width: 120 }} />
        )}
        <Select label="Hypothesis" fullWidth={false} value={alt} onChange={(e) => setAlt(e.target.value as Alternative)}
          options={[
            { label: 'Mean exceeds it', value: 'greater' },
            { label: 'Mean differs from it', value: 'two_sided' },
            { label: 'Mean below it', value: 'less' },
          ]} />
        <Select label="Tower" fullWidth={false} value={tower} onChange={(e) => setTower(e.target.value)} options={towerOpts} />
      </div>

      {!enabled ? (
        <p className="text-muted" style={{ fontSize: 14, margin: 0 }}>
          {needsGrade ? 'Pick a grade to test against its ' + (basis === 'fck' ? 'characteristic strength.' : 'target mean strength.') : 'Enter a reference value to test against.'}
        </p>
      ) : error ? (
        <p style={{ fontSize: 14, margin: 0, color: 'var(--red)' }}>{getApiErrorMessage(error, 'Could not run the test.')}</p>
      ) : !data ? (
        <p className="text-muted" style={{ fontSize: 14, margin: 0 }}>{isFetching ? 'Running…' : ''}</p>
      ) : (
        <>
          <Verdict significant={data.significant} text={data.verdict} />
          <div style={grid}>
            <Stat label="Samples" value={data.sample_count} />
            <Stat label="Mean" value={`${fmt(data.mean)} MPa`} />
            <Stat label={`${Math.round(data.confidence * 100)}% CI`} value={`${fmt(data.ci_low)} – ${fmt(data.ci_high)}`} />
            <Stat label="Reference (µ₀)" value={`${fmt(data.mu0)} MPa`} />
            <Stat label="t" value={fmt(data.t_statistic, 3)} />
            <Stat label="df" value={fmt(data.df, 1)} />
            <Stat label="p-value" value={fmtP(data.p_value)} />
          </div>
          {data.values.length >= 2 && <OneSampleChart d={data} />}
        </>
      )}
    </Card>
  );
};

// ── Two-sample panel ─────────────────────────────────────────────────────────

const GroupControls: React.FC<{
  title: string; g: GroupFilter; onChange: (g: GroupFilter) => void;
  gradeOpts: { label: string; value: string | number }[];
  towerOpts: { label: string; value: string | number }[];
  supplierOpts: { label: string; value: string | number }[];
}> = ({ title, g, onChange, gradeOpts, towerOpts, supplierOpts }) => {
  const set = (patch: Partial<GroupFilter>) => onChange({ ...g, ...patch });
  const num = (v: string) => (v ? Number(v) : undefined);
  return (
    <div style={{ flex: 1, minWidth: 240, border: '1px solid var(--gray-200)', borderRadius: 8, padding: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 8 }}>{title}</div>
      <Input label="Label" fullWidth value={g.label ?? ''} onChange={(e) => set({ label: e.target.value || undefined })} placeholder={title} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        <Select label="Grade" fullWidth={false} value={String(g.grade_id ?? '')} onChange={(e) => set({ grade_id: num(e.target.value) })} options={gradeOpts} />
        <Select label="Tower" fullWidth={false} value={String(g.tower_id ?? '')} onChange={(e) => set({ tower_id: num(e.target.value) })} options={towerOpts} />
        <Select label="Supplier" fullWidth={false} value={String(g.supplier_id ?? '')} onChange={(e) => set({ supplier_id: num(e.target.value) })} options={supplierOpts} />
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        <Input label="From" type="date" fullWidth={false} value={g.date_from ?? ''} onChange={(e) => set({ date_from: e.target.value || undefined })} />
        <Input label="To" type="date" fullWidth={false} value={g.date_to ?? ''} onChange={(e) => set({ date_to: e.target.value || undefined })} />
      </div>
    </div>
  );
};

const TwoSamplePanel: React.FC<{ pid: number; confidence: number }> = ({ pid, confidence }) => {
  const { data: grades = [] } = useGrades();
  const { data: towers = [] } = useProjectTowers(pid);
  const { data: suppliers = [] } = useSuppliers(pid);

  const [a, setA] = useState<GroupFilter>({ label: 'Group A' });
  const [b, setB] = useState<GroupFilter>({ label: 'Group B' });
  const [alt, setAlt] = useState<Alternative>('two_sided');
  const compare = useTwoSampleTTest(pid);

  const gradeOpts = useMemo(() => [{ label: 'Any grade', value: '' }, ...grades.map((g) => ({ label: g.grade_name, value: g.grade_id }))], [grades]);
  const towerOpts = useMemo(() => [{ label: 'Any tower', value: '' }, ...towers.map((t) => ({ label: t.tower_name, value: t.tower_id }))], [towers]);
  const supplierOpts = useMemo(() => [{ label: 'Any supplier', value: '' }, ...suppliers.map((s) => ({ label: s.supplier_name, value: s.supplier_id }))], [suppliers]);

  const result = compare.data as TwoSampleTTest | undefined;

  return (
    <Card>
      <h3 className="qms-chart-heading">Compare two selections (two-sample t-test)</h3>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'stretch' }}>
        <GroupControls title="Group A" g={a} onChange={setA} gradeOpts={gradeOpts} towerOpts={towerOpts} supplierOpts={supplierOpts} />
        <GroupControls title="Group B" g={b} onChange={setB} gradeOpts={gradeOpts} towerOpts={towerOpts} supplierOpts={supplierOpts} />
      </div>
      <div style={{ ...filterRow, marginTop: 12 }}>
        <Select label="Hypothesis" fullWidth={false} value={alt} onChange={(e) => setAlt(e.target.value as Alternative)}
          options={[
            { label: 'A differs from B', value: 'two_sided' },
            { label: 'A greater than B', value: 'greater' },
            { label: 'A less than B', value: 'less' },
          ]} />
        <Button onClick={() => compare.mutate({ group_a: a, group_b: b, confidence, alternative: alt })} disabled={compare.isPending}>
          {compare.isPending ? 'Comparing…' : 'Compare'}
        </Button>
      </div>

      {compare.error ? (
        <p style={{ fontSize: 14, margin: 0, color: 'var(--red)' }}>{getApiErrorMessage(compare.error, 'Could not compare.')}</p>
      ) : result ? (
        <>
          <Verdict significant={result.significant} text={result.verdict} />
          <div style={grid}>
            <Stat label={result.group_a.label} value={`${fmt(result.group_a.mean)} MPa · n=${result.group_a.sample_count}`} />
            <Stat label={result.group_b.label} value={`${fmt(result.group_b.mean)} MPa · n=${result.group_b.sample_count}`} />
            <Stat label="Mean difference" value={`${fmt(result.mean_diff)} MPa`} />
            <Stat label={`${Math.round(result.confidence * 100)}% CI (diff)`} value={`${fmt(result.ci_low)} – ${fmt(result.ci_high)}`} />
            <Stat label="t" value={fmt(result.t_statistic, 3)} />
            <Stat label="df" value={fmt(result.df, 1)} />
            <Stat label="p-value" value={fmtP(result.p_value)} />
          </div>
          {result.group_a.values.length >= 2 && result.group_b.values.length >= 2 && <TwoSampleChart r={result} />}
        </>
      ) : null}
    </Card>
  );
};

// ── Section ──────────────────────────────────────────────────────────────────

export const TTestSection: React.FC<{
  pid: number;
  oneSampleRef?: React.Ref<HTMLDivElement>;
  twoSampleRef?: React.Ref<HTMLDivElement>;
}> = ({ pid, oneSampleRef, twoSampleRef }) => {
  const [confPct, setConfPct] = useState('95');
  const confidence = Number(confPct) / 100;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, margin: '4px 0' }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--gray-900)', margin: 0 }}>Statistical tests</h2>
        <Select label="Confidence level" fullWidth={false} value={confPct} onChange={(e) => setConfPct(e.target.value)} options={CONF_OPTS} />
      </div>
      <div ref={oneSampleRef}><OneSamplePanel pid={pid} confidence={confidence} /></div>
      <div ref={twoSampleRef}><TwoSamplePanel pid={pid} confidence={confidence} /></div>
    </>
  );
};
