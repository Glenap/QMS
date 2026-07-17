// Analytics — the IS-456 / IS-10262 statistical charts. Each chart has its OWN
// filter row (grade / tower / contractor / period) defaulting to a concrete
// grade + tower and the last 7 days. Points are clickable through to the cube's
// traceability, and any selection of charts can be exported to PDF.

import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import {
  Area, CartesianGrid, ComposedChart, Line, LineChart,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Card } from '../../components/ui/Card';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { useProject } from '../../components/layout/ProjectLayout';
import { DateRangeFilter } from '../../components/analytics/DateRangeFilter';
import { presetRange, type DatePreset } from '../../components/analytics/dateRange';
import { TTestSection } from '../../components/analytics/TTestSection';
import { useCusum, useDistribution, useRunChart } from '../../queries/analytics';
import { useProjectTowers } from '../../queries/floors';
import { useGrades } from '../../queries/catalog';
import { useProjectContractors } from '../../queries/contractors';
import { cubeTestsApi } from '../../api/cubeTests';
import { exportChartsPdf, type ChartSection } from '../../lib/exportChartsPdf';
import type { CusumPoint } from '../../types/master';
import './Analytics.css';

const n = (v: string): number | undefined => (v ? Number(v) : undefined);

const empty = <p className="text-muted" style={{ fontSize: 14, margin: 0 }}>No cube-test data for this selection yet.</p>;

const filterRow: React.CSSProperties = { display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 12 };

// recharts v3 hands the click the active tick's index (activeTooltipIndex), not
// a payload — so we look the datum up in the chart's own data array.
type ChartClick = { activeTooltipIndex?: unknown };
type TraceablePoint = { sample_reference?: string | null };

export const Analytics: React.FC = () => {
  const { project } = useProject();
  const pid = project.project_id;
  const isClient = project.access.side === 'CLIENT';
  const navigate = useNavigate();
  const base = `/app/projects/${pid}`;

  const { data: towers = [] } = useProjectTowers(pid);
  const { data: grades = [] } = useGrades();
  const { data: contractors = [] } = useProjectContractors(pid, isClient);
  const { data: samples = [] } = useQuery({
    queryKey: ['cube-samples', pid],
    queryFn: () => cubeTestsApi.listSamples(pid),
  });

  const gradeOpts = grades.map((g) => ({ label: g.grade_name, value: g.grade_id }));
  const towerOpts = towers.map((t) => ({ label: t.tower_name, value: t.tower_id }));
  const contractorOpts = contractors
    .filter((c) => c.status === 'ACCEPTED')
    .map((c) => ({ label: c.contractor_org_name, value: c.contractor_org_id }));

  // Default each chart to the freshest batch that already has lab results (so the
  // default view shows real data), mapping its grade/tower names back to ids;
  // fall back to the first option otherwise.
  const recent = samples.find((s) => s.tests.length > 0) ?? samples[0];
  const recentGradeId = recent ? grades.find((g) => g.grade_name === recent.grade_name)?.grade_id : undefined;
  const recentTowerId = recent ? towers.find((t) => t.tower_name === recent.tower_name)?.tower_id : undefined;
  const firstGrade = String(recentGradeId ?? grades[0]?.grade_id ?? '');
  const firstTower = String(recentTowerId ?? towers[0]?.tower_id ?? '');

  // ── Per-chart filter state ──
  const [rG, setRG] = useState(''); const [rT, setRT] = useState(''); const [rC, setRC] = useState('ALL');
  const [rPreset, setRPreset] = useState<DatePreset>('7');
  const [rFrom, setRFrom] = useState(''); const [rTo, setRTo] = useState('');
  const [dG, setDG] = useState(''); const [dT, setDT] = useState(''); const [dC, setDC] = useState('ALL');
  const [uG, setUG] = useState(''); const [uT, setUT] = useState(''); const [uC, setUC] = useState('ALL');

  const runGrade = rG || firstGrade;
  const runTower = rT || firstTower;
  const distGrade = dG || firstGrade;
  const distTower = dT || firstTower;
  const cusumGrade = uG || firstGrade;
  const cusumTower = uT || firstTower;
  const runRange = presetRange(rPreset, rFrom, rTo);

  const { data: run } = useRunChart(pid, {
    grade_id: n(runGrade), tower_id: n(runTower),
    contractor_id: rC !== 'ALL' ? Number(rC) : undefined,
    date_from: runRange.date_from, date_to: runRange.date_to,
  });
  const { data: dist } = useDistribution(pid, {
    grade_id: n(distGrade), tower_id: n(distTower),
    contractor_id: dC !== 'ALL' ? Number(dC) : undefined,
  });
  const { data: cusum } = useCusum(pid, {
    grade_id: n(cusumGrade), tower_id: n(cusumTower),
    contractor_id: uC !== 'ALL' ? Number(uC) : undefined,
  });

  const runData = (run?.points ?? []).map((p, i) => ({ ...p, idx: i + 1 }));
  const cusumData = cusum?.points ?? [];

  // Click a data point → open that cube's traceability chain.
  const goToTrace = (data: TraceablePoint[]) => (state: ChartClick) => {
    const idx = Number(state?.activeTooltipIndex);
    if (!Number.isInteger(idx) || idx < 0) return;
    const ref = data[idx]?.sample_reference;
    if (ref) navigate(`${base}/trace?q=${encodeURIComponent(ref)}`);
  };

  // ── PDF export ──
  const runRef = useRef<HTMLDivElement>(null);
  const distRef = useRef<HTMLDivElement>(null);
  const cusumRef = useRef<HTMLDivElement>(null);
  const oneSampleRef = useRef<HTMLDivElement>(null);
  const twoSampleRef = useRef<HTMLDivElement>(null);
  const [sel, setSel] = useState({ run: true, dist: true, cusum: true, oneSample: false, twoSample: false });
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    const sections: ChartSection[] = [];
    if (sel.run && runRef.current) sections.push({ title: 'Quality control run chart', el: runRef.current });
    if (sel.dist && distRef.current) sections.push({ title: 'Normal distribution', el: distRef.current });
    if (sel.cusum && cusumRef.current) sections.push({ title: 'CUSUM control chart', el: cusumRef.current });
    if (sel.oneSample && oneSampleRef.current) sections.push({ title: 'One-sample t-test', el: oneSampleRef.current });
    if (sel.twoSample && twoSampleRef.current) sections.push({ title: 'Two-sample t-test', el: twoSampleRef.current });
    if (sections.length === 0) return;
    setExporting(true);
    try {
      await exportChartsPdf(sections, {
        fileName: `analytics-${project.project_name}.pdf`.replace(/\s+/g, '-'),
        heading: project.project_name,
        subheading: `Analytics report · ${new Date().toLocaleDateString()}`,
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="qms-analytics">
      {/* PDF export toolbar */}
      <div className="qms-an-export">
        <span className="qms-an-export-label">Export to PDF:</span>
        <label><input type="checkbox" checked={sel.run} onChange={(e) => setSel((s) => ({ ...s, run: e.target.checked }))} /> Run chart</label>
        <label><input type="checkbox" checked={sel.dist} onChange={(e) => setSel((s) => ({ ...s, dist: e.target.checked }))} /> Distribution</label>
        <label><input type="checkbox" checked={sel.cusum} onChange={(e) => setSel((s) => ({ ...s, cusum: e.target.checked }))} /> CUSUM</label>
        <label><input type="checkbox" checked={sel.oneSample} onChange={(e) => setSel((s) => ({ ...s, oneSample: e.target.checked }))} /> One-sample t-test</label>
        <label><input type="checkbox" checked={sel.twoSample} onChange={(e) => setSel((s) => ({ ...s, twoSample: e.target.checked }))} /> Two-sample t-test</label>
        <Button size="sm" variant="outline" icon={<Download size={14} />} onClick={handleExport} disabled={exporting}>
          {exporting ? 'Generating…' : 'Download PDF'}
        </Button>
      </div>

      {/* 1 · Quality control run chart */}
      <div ref={runRef}>
        <Card>
          <h3 className="qms-chart-heading">Quality control run chart</h3>
          <div style={filterRow}>
            <Select label="Grade" fullWidth={false} value={runGrade} onChange={(e) => setRG(e.target.value)} options={gradeOpts} />
            <Select label="Tower" fullWidth={false} value={runTower} onChange={(e) => setRT(e.target.value)} options={towerOpts} />
            {contractorOpts.length > 0 && (
              <Select label="Contractor" fullWidth={false} value={rC} onChange={(e) => setRC(e.target.value)}
                options={[{ label: 'All contractors', value: 'ALL' }, ...contractorOpts]} />
            )}
            <DateRangeFilter preset={rPreset} from={rFrom} to={rTo} onPreset={setRPreset} onFrom={setRFrom} onTo={setRTo} />
          </div>
          {runData.length === 0 ? empty : (
            <>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={runData} style={{ cursor: 'pointer' }} onClick={goToTrace(runData)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                  <XAxis dataKey="idx" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} label={{ value: 'cube (chronological)', position: 'insideBottom', offset: -2, fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} unit=" MPa" />
                  <Tooltip formatter={(v) => `${v} MPa`} labelFormatter={(i) => { const p = runData[Number(i) - 1]; return p?.sample_reference ?? p?.reference ?? p?.test_date ?? ''; }} />
                  {run?.fck != null && <ReferenceLine y={run.fck} stroke="var(--green)" strokeDasharray="4 4" label={{ value: `fck ${run.fck}`, fontSize: 11, fill: 'var(--green)' }} />}
                  {run?.individual_min != null && <ReferenceLine y={run.individual_min} stroke="var(--red)" strokeDasharray="4 4" label={{ value: `min ${run.individual_min}`, fontSize: 11, fill: 'var(--red)' }} />}
                  {run?.target_mean != null && <ReferenceLine y={run.target_mean} stroke="var(--blue)" strokeDasharray="4 4" label={{ value: `target ${run.target_mean}`, fontSize: 11, fill: 'var(--blue)' }} />}
                  <Line type="monotone" dataKey="observed_mpa" name="Observed" stroke="var(--blue)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
              <p className="qms-chart-hint">Tip: click a point to open that cube&apos;s traceability.</p>
            </>
          )}
        </Card>
      </div>

      {/* 2 · Normal distribution curve */}
      <div ref={distRef}>
        <Card>
          <h3 className="qms-chart-heading">Normal distribution {dist?.mean != null ? `(X̄ ${dist.mean}, S ${dist.std_dev}, n ${dist.sample_count})` : ''}</h3>
          <div style={filterRow}>
            <Select label="Grade" fullWidth={false} value={distGrade} onChange={(e) => setDG(e.target.value)} options={gradeOpts} />
            <Select label="Tower" fullWidth={false} value={distTower} onChange={(e) => setDT(e.target.value)} options={towerOpts} />
            {contractorOpts.length > 0 && (
              <Select label="Contractor" fullWidth={false} value={dC} onChange={(e) => setDC(e.target.value)}
                options={[{ label: 'All contractors', value: 'ALL' }, ...contractorOpts]} />
            )}
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
      </div>

      {/* 3 · CUSUM control chart */}
      <div ref={cusumRef}>
        <Card>
          <h3 className="qms-chart-heading">CUSUM control chart {cusum?.target_mean != null ? `(target mean ${cusum.target_mean} MPa)` : ''}</h3>
          <p className="qms-chart-sub">Cumulative sum of (observed − target mean) by cube. A sustained downward slope signals a fall in mean strength earlier than pass/fail alone.</p>
          <div style={filterRow}>
            <Select label="Grade" fullWidth={false} value={cusumGrade} onChange={(e) => setUG(e.target.value)} options={gradeOpts} />
            <Select label="Tower" fullWidth={false} value={cusumTower} onChange={(e) => setUT(e.target.value)} options={towerOpts} />
            {contractorOpts.length > 0 && (
              <Select label="Contractor" fullWidth={false} value={uC} onChange={(e) => setUC(e.target.value)}
                options={[{ label: 'All contractors', value: 'ALL' }, ...contractorOpts]} />
            )}
          </div>
          {cusumData.length === 0 ? empty : (
            <>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={cusumData} style={{ cursor: 'pointer' }} onClick={goToTrace(cusumData)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                  <XAxis dataKey="index" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} label={{ value: 'cube number', position: 'insideBottom', offset: -2, fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} unit=" MPa" />
                  <Tooltip
                    formatter={(v) => [`${v} MPa`, 'CUSUM']}
                    labelFormatter={(i) => { const p = cusumData.find((c: CusumPoint) => c.index === Number(i)); return p?.sample_reference ?? `cube ${i}`; }}
                  />
                  <ReferenceLine y={0} stroke="var(--gray-300)" />
                  <Line type="monotone" dataKey="cusum" name="CUSUM" stroke="var(--blue)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
              <p className="qms-chart-hint">Tip: click a point to open that cube&apos;s traceability.</p>
            </>
          )}
        </Card>
      </div>

      {/* 4 · Statistical tests (Student's t) */}
      <TTestSection pid={pid} oneSampleRef={oneSampleRef} twoSampleRef={twoSampleRef} />
    </div>
  );
};
