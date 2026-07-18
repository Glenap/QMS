// Outlier scan — flags cube results that are statistically inconsistent with the
// rest of the dataset using the modified Thompson τ technique (Cimbala, "Outliers").
// Each result is plotted in test order; points outside the mean ± τ·S band are
// rejected as outliers. The mean/StDev before vs. after removal is reported — a
// large StDev drop after excluding points is a red flag for copied/fabricated
// readings. All numbers come from the backend (/analytics/outliers).

import React, { forwardRef, useState } from 'react';
import {
  CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import { Card } from '../ui/Card';
import { Select } from '../ui/Select';
import { DateRangeFilter } from './DateRangeFilter';
import { presetRange, type DatePreset } from './dateRange';
import { useOutliers } from '../../queries/analytics';

type Opt = { label: string; value: string | number };

interface Props {
  pid: number;
  gradeOpts: Opt[];
  towerOpts: Opt[];
  contractorOpts: Opt[];
  firstGrade: string;
  firstTower: string;
  tid: (v: string) => number | undefined;
}

const num = (v: string): number | undefined => (v ? Number(v) : undefined);
const fmt = (x: number | null | undefined, dp = 2): string =>
  x == null ? '—' : x.toLocaleString(undefined, { maximumFractionDigits: dp });

const filterRow: React.CSSProperties = {
  display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 12,
};

export const OutliersPanel = forwardRef<HTMLDivElement, Props>(function OutliersPanel(
  { pid, gradeOpts, towerOpts, contractorOpts, firstGrade, firstTower, tid }, ref,
) {
  const [g, setG] = useState('');
  const [t, setT] = useState('');
  const [c, setC] = useState('ALL');
  const [preset, setPreset] = useState<DatePreset>('7');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const grade = g || firstGrade;
  const tower = t || firstTower;
  const range = presetRange(preset, from, to);

  const { data } = useOutliers(pid, {
    grade_id: num(grade), tower_id: tid(tower),
    contractor_id: c !== 'ALL' ? Number(c) : undefined,
    date_from: range.date_from, date_to: range.date_to,
  });

  const points = data?.points ?? [];
  const testable = points.length >= 3;
  const normal = points.filter((p) => !p.is_outlier).map((p) => ({ x: p.index, y: p.value }));
  const flagged = points.filter((p) => p.is_outlier).map((p) => ({ x: p.index, y: p.value }));

  const mean = data?.mean ?? null;
  const threshold = data?.threshold ?? null;
  const upper = mean != null && threshold != null ? mean + threshold : null;
  const lower = mean != null && threshold != null ? mean - threshold : null;

  return (
    <div ref={ref}>
      <Card>
        <h3 className="qms-chart-heading">
          Outlier scan{data?.grade_name ? ` · ${data.grade_name}` : ''}
        </h3>
        <p className="qms-chart-sub">
          Modified Thompson τ test (α = 0.05): results outside the mean ± τ·S band are statistically
          inconsistent with the rest and flagged. Method: Cimbala, “Outliers”.
        </p>

        <div style={filterRow}>
          <Select label="Grade" fullWidth={false} value={grade} onChange={(e) => setG(e.target.value)} options={gradeOpts} />
          <Select label="Tower" fullWidth={false} value={tower} onChange={(e) => setT(e.target.value)} options={towerOpts} />
          {contractorOpts.length > 0 && (
            <Select label="Contractor" fullWidth={false} value={c} onChange={(e) => setC(e.target.value)}
              options={[{ label: 'All contractors', value: 'ALL' }, ...contractorOpts]} />
          )}
          <DateRangeFilter preset={preset} from={from} to={to} onPreset={setPreset} onFrom={setFrom} onTo={setTo} />
        </div>

        {!testable ? (
          <p className="text-muted" style={{ fontSize: 14, margin: 0 }}>
            Need at least three cube results for this selection to scan for outliers.
          </p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={280}>
              <ScatterChart margin={{ top: 16, right: 16, bottom: 16, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                <XAxis type="number" dataKey="x" name="test" domain={[0, points.length + 1]} allowDecimals={false}
                  tick={{ fontSize: 11 }} axisLine={false} tickLine={false} height={28}
                  label={{ value: 'result (in test order)', position: 'insideBottom', offset: -4, fontSize: 11, fill: 'var(--gray-500)' }} />
                <YAxis type="number" dataKey="y" name="strength" tick={{ fontSize: 11 }} axisLine={false} tickLine={false}
                  width={40} unit="" label={{ value: 'MPa', angle: -90, position: 'insideLeft', fontSize: 11, fill: 'var(--gray-500)' }} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }}
                  formatter={(v) => `${Number(v).toFixed(1)} MPa`}
                  labelFormatter={() => ''} />
                {mean != null && (
                  <ReferenceLine y={mean} stroke="var(--green)" strokeDasharray="4 4"
                    label={{ value: `mean ${fmt(mean)}`, fontSize: 11, fill: 'var(--green)', position: 'right' }} />
                )}
                {upper != null && (
                  <ReferenceLine y={upper} stroke="var(--red)" strokeDasharray="5 3"
                    label={{ value: 'τ·S', fontSize: 10, fill: 'var(--red)', position: 'right' }} />
                )}
                {lower != null && <ReferenceLine y={lower} stroke="var(--red)" strokeDasharray="5 3" />}
                <Scatter name="results" data={normal} fill="var(--blue)" isAnimationActive={false} />
                <Scatter name="outliers" data={flagged} fill="var(--red)" isAnimationActive={false} />
              </ScatterChart>
            </ResponsiveContainer>

            <div className={`qms-out-summary ${data!.outlier_count > 0 ? 'is-warn' : 'is-ok'}`}>
              {data!.outlier_count === 0 ? (
                <span>No statistical outliers — all {data!.sample_count} results are consistent.</span>
              ) : (
                <span>
                  <strong>{data!.outlier_count} outlier{data!.outlier_count > 1 ? 's' : ''} flagged:</strong>{' '}
                  {data!.outliers.map((o) => `${o} MPa`).join(', ')}. Excluding them, StDev falls from{' '}
                  <strong>{fmt(data!.std_dev)}</strong> to <strong>{fmt(data!.clean_std_dev)}</strong>{' '}
                  (mean {fmt(data!.mean)} → {fmt(data!.clean_mean)}).
                </span>
              )}
            </div>
            <p className="qms-chart-hint" style={{ marginTop: 8 }}>
              Red points lie beyond the mean ± τ·S band. Investigate flagged results before accepting —
              a genuine outlier should be justified, never quietly deleted.
            </p>
          </>
        )}
      </Card>
    </div>
  );
});
