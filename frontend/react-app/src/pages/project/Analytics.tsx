// Analytics — the four IS-456 / IS-10262 statistical charts. Each chart is for a
// specific thing, so each has its OWN filter row that defaults to a concrete
// grade / tower / element / batch (no "all" aggregate views).

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Area, Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, LineChart,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Card } from '../../components/ui/Card';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import { useProject } from '../../components/layout/ProjectLayout';
import {
  useDistribution, useRunChart, useStrengthVsAge, useTargetMean,
} from '../../queries/analytics';
import { useProjectTowers } from '../../queries/floors';
import { useGrades } from '../../queries/catalog';
import { cubeTestsApi } from '../../api/cubeTests';
import './Analytics.css';

const n = (v: string): number | undefined => (v ? Number(v) : undefined);

const empty = <p className="text-muted" style={{ fontSize: 14, margin: 0 }}>No cube-test data for this selection yet.</p>;

const filterRow: React.CSSProperties = { display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 12 };

export const Analytics: React.FC = () => {
  const { project } = useProject();
  const pid = project.project_id;

  const { data: towers = [] } = useProjectTowers(pid);
  const { data: grades = [] } = useGrades();
  const { data: samples = [] } = useQuery({
    queryKey: ['cube-samples', pid],
    queryFn: () => cubeTestsApi.listSamples(pid),
  });

  const gradeOpts = grades.map((g) => ({ label: g.grade_name, value: g.grade_id }));
  const towerOpts = towers.map((t) => ({ label: t.tower_name, value: t.tower_id }));
  const sampleOpts = samples.map((s) => ({
    label: s.sample_reference ?? `Sample #${s.sample_id}`, value: s.sample_id,
  }));

  // Default every chart to the freshest data — the most recently cast batch that
  // already has lab results (samples come back cast-date-descending) — mapping its
  // grade/tower names back to ids. Falls back to the first option otherwise.
  const recent = samples.find((s) => s.tests.length > 0) ?? samples[0];
  const recentGradeId = recent ? grades.find((g) => g.grade_name === recent.grade_name)?.grade_id : undefined;
  const recentTowerId = recent ? towers.find((t) => t.tower_name === recent.tower_name)?.tower_id : undefined;

  const firstGrade = String(recentGradeId ?? grades[0]?.grade_id ?? '');
  const firstTower = String(recentTowerId ?? towers[0]?.tower_id ?? '');
  const firstSample = String(recent?.sample_id ?? '');

  // ── Per-chart filter state (each defaults to the most recent data) ──
  const [rG, setRG] = useState(''); const [rT, setRT] = useState('');
  const [rFrom, setRFrom] = useState(''); const [rTo, setRTo] = useState('');
  const [dG, setDG] = useState(''); const [dT, setDT] = useState('');
  const [tT, setTT] = useState('');
  const [aS, setAS] = useState('');

  const runGrade = rG || firstGrade;
  const runTower = rT || firstTower;
  const distGrade = dG || firstGrade;
  const distTower = dT || firstTower;
  const targetTower = tT || firstTower;
  const ageSample = aS || firstSample;

  const { data: run } = useRunChart(pid, { grade_id: n(runGrade), tower_id: n(runTower), date_from: rFrom || undefined, date_to: rTo || undefined });
  const { data: dist } = useDistribution(pid, { grade_id: n(distGrade), tower_id: n(distTower) });
  const { data: target } = useTargetMean(pid, { tower_id: n(targetTower) });
  const { data: age } = useStrengthVsAge(pid, { sample_id: n(ageSample) });

  const runData = (run?.points ?? []).map((p, i) => ({ ...p, idx: i + 1 }));
  const targetRows = target?.rows ?? [];

  return (
    <div className="qms-analytics">
      <div className="qms-analytics-header">
        <h1 className="qms-page-title-main">Analytics</h1>
        <p className="qms-page-subtitle">IS 456 / IS 10262 concrete-strength statistics</p>
      </div>

      {/* 1 · Quality control run chart */}
      <Card>
        <h3 className="qms-chart-heading">Quality control run chart</h3>
        <div style={filterRow}>
          <Select label="Grade" fullWidth={false} value={runGrade} onChange={(e) => setRG(e.target.value)} options={gradeOpts} />
          <Select label="Tower" fullWidth={false} value={runTower} onChange={(e) => setRT(e.target.value)} options={towerOpts} />
          <Input label="From" type="date" fullWidth={false} value={rFrom} onChange={(e) => setRFrom(e.target.value)} />
          <Input label="To" type="date" fullWidth={false} value={rTo} onChange={(e) => setRTo(e.target.value)} />
        </div>
        {runData.length === 0 ? empty : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={runData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
              <XAxis dataKey="idx" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} label={{ value: 'batch (chronological)', position: 'insideBottom', offset: -2, fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} unit=" MPa" />
              <Tooltip formatter={(v) => `${v} MPa`} labelFormatter={(i) => runData[Number(i) - 1]?.reference ?? runData[Number(i) - 1]?.test_date ?? ''} />
              {run?.fck != null && <ReferenceLine y={run.fck} stroke="var(--green)" strokeDasharray="4 4" label={{ value: `fck ${run.fck}`, fontSize: 11, fill: 'var(--green)' }} />}
              {run?.individual_min != null && <ReferenceLine y={run.individual_min} stroke="var(--red)" strokeDasharray="4 4" label={{ value: `min ${run.individual_min}`, fontSize: 11, fill: 'var(--red)' }} />}
              {run?.target_mean != null && <ReferenceLine y={run.target_mean} stroke="var(--blue)" strokeDasharray="4 4" label={{ value: `target ${run.target_mean}`, fontSize: 11, fill: 'var(--blue)' }} />}
              <Line type="monotone" dataKey="observed_mpa" name="Observed" stroke="var(--blue)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      <div className="qms-an-grid-2">
        {/* 2 · Normal distribution curve */}
        <Card>
          <h3 className="qms-chart-heading">Normal distribution {dist?.mean != null ? `(X̄ ${dist.mean}, S ${dist.std_dev}, n ${dist.sample_count})` : ''}</h3>
          <div style={filterRow}>
            <Select label="Grade" fullWidth={false} value={distGrade} onChange={(e) => setDG(e.target.value)} options={gradeOpts} />
            <Select label="Tower" fullWidth={false} value={distTower} onChange={(e) => setDT(e.target.value)} options={towerOpts} />
          </div>
          {(dist?.curve.length ?? 0) === 0 ? (
            <p className="text-muted" style={{ fontSize: 14, margin: 0 }}>Need at least two results to draw the curve.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={dist!.curve}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                <XAxis dataKey="x" type="number" domain={['dataMin', 'dataMax']} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} unit=" MPa" />
                <YAxis tick={false} axisLine={false} tickLine={false} width={8} />
                <Tooltip formatter={(v) => Number(v).toFixed(4)} labelFormatter={(x) => `${x} MPa`} />
                <Area type="monotone" dataKey="y" stroke="var(--blue)" fill="var(--blue)" fillOpacity={0.12} strokeWidth={2} />
                {dist?.fck != null && <ReferenceLine x={dist.fck} stroke="var(--red)" strokeDasharray="4 4" label={{ value: `fck ${dist.fck}`, fontSize: 11, fill: 'var(--red)' }} />}
                {dist?.mean != null && <ReferenceLine x={dist.mean} stroke="var(--green)" strokeDasharray="4 4" label={{ value: 'X̄', fontSize: 11, fill: 'var(--green)' }} />}
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* 3 · Target mean strength bar */}
        <Card>
          <h3 className="qms-chart-heading">Target mean vs achieved (per grade)</h3>
          <div style={filterRow}>
            <Select label="Tower" fullWidth={false} value={targetTower} onChange={(e) => setTT(e.target.value)} options={towerOpts} />
          </div>
          {targetRows.length === 0 ? empty : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={targetRows}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                <XAxis dataKey="grade_name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} unit=" MPa" />
                <Tooltip formatter={(v) => `${v} MPa`} />
                <Legend />
                <Bar dataKey="target_mean" name="Target mean (RMC design)" fill="var(--blue)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="actual_mean" name="Achieved average" fill="var(--green)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* 4 · Compressive strength vs age (per batch) */}
      <Card>
        <h3 className="qms-chart-heading">Compressive strength vs age {age?.grade_name ? `— ${age.grade_name}` : ''}</h3>
        <div style={filterRow}>
          <Select label="Batch (lab reference)" fullWidth={false} value={ageSample} onChange={(e) => setAS(e.target.value)}
            options={sampleOpts.length ? sampleOpts : [{ label: 'No batches yet', value: '' }]} />
        </div>
        {(age?.points.length ?? 0) === 0 ? (
          <p className="text-muted" style={{ fontSize: 14, margin: 0 }}>No 7/14/28-day results for this batch yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={age!.points}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
              <XAxis dataKey="test_age_days" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} unit=" d" />
              <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} unit=" MPa" />
              <Tooltip formatter={(v) => `${v} MPa`} labelFormatter={(d) => `${d}-day`} />
              <Legend />
              <Line type="monotone" dataKey="observed_mpa" name="Observed" stroke="var(--blue)" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="required_mpa" name="Required" stroke="var(--gray-400)" strokeDasharray="4 4" strokeWidth={2} dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
};
