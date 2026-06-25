import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, TestTube, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import { useProject } from '../../components/layout/ProjectLayout';
import { useAuth } from '../../hooks/useAuth';
import { cubeTestsApi } from '../../api/cubeTests';
import { poursApi } from '../../api/pours';
import { labsApi } from '../../api/labs';
import { getApiErrorMessage } from '../../api/client';
import type {
  CubeSampleResponse,
  CubeTestResponse,
  LabResponse,
  PourResponse,
  ResultStatus,
} from '../../types/master';

const RESULT_VARIANT: Record<ResultStatus, 'pass' | 'fail' | 'warn' | 'pending'> = {
  PENDING: 'pending', PASS: 'pass', FAIL: 'warn', CRITICAL_FAILURE: 'fail',
};
const RESULT_LABEL: Record<ResultStatus, string> = {
  PENDING: 'Pending', PASS: 'Pass', FAIL: 'Fail', CRITICAL_FAILURE: 'Critical',
};

// Mirrors backend quality_engine.DEFAULT_AGE_FRACTIONS — a client-side hint only;
// the server computes the authoritative required strength.
const AGE_FRACTION: Record<number, number> = { 7: 0.65, 14: 0.9, 28: 1.0 };
const AGE_OPTIONS = [7, 14, 28];

const fmtDate = (iso: string | null): string => (iso ? new Date(iso).toLocaleDateString() : '—');

// Worst outcome across a sample's tests, for the collapsed row summary.
const worstResult = (tests: CubeTestResponse[]): ResultStatus | null => {
  if (tests.some((t) => t.result_status === 'CRITICAL_FAILURE')) return 'CRITICAL_FAILURE';
  if (tests.some((t) => t.result_status === 'FAIL')) return 'FAIL';
  if (tests.some((t) => t.result_status === 'PENDING')) return 'PENDING';
  if (tests.length > 0) return 'PASS';
  return null;
};

const errorBox = (msg: string) => (
  <div style={{ padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 14, background: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5' }}>
    {msg}
  </div>
);

export const ProjectCubeTests: React.FC = () => {
  const { project } = useProject();
  const { user } = useAuth();
  const pid = project.project_id;
  const isQE = user?.role === 'QUALITY_ENGINEER';

  const [samples, setSamples] = useState<CubeSampleResponse[]>([]);
  const [pours, setPours] = useState<PourResponse[]>([]);
  const [labs, setLabs] = useState<LabResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cast-sample form.
  const [showCast, setShowCast] = useState(false);
  const [pourId, setPourId] = useState('');
  const [castDate, setCastDate] = useState('');
  const [noOfCubes, setNoOfCubes] = useState('3');
  const [castLabId, setCastLabId] = useState('');
  const [sampleRef, setSampleRef] = useState('');
  const [casting, setCasting] = useState(false);

  // Record-result form (for the one expanded sample).
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [age, setAge] = useState('28');
  const [testDate, setTestDate] = useState('');
  const [observed, setObserved] = useState('');
  const [recording, setRecording] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, p, l] = await Promise.all([
        cubeTestsApi.listSamples(pid),
        poursApi.list(pid),
        labsApi.list(pid),
      ]);
      setSamples(s);
      setPours(p);
      setLabs(l);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to load cube tests.'));
    } finally {
      setLoading(false);
    }
  }, [pid]);

  useEffect(() => { void load(); }, [load]);

  const canCast = pourId !== '' && castDate !== '' && Number(noOfCubes) > 0;

  const handleCast = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCasting(true);
    try {
      await cubeTestsApi.castSample(pid, Number(pourId), {
        sample_reference: sampleRef.trim() || null,
        cast_date: castDate,
        no_of_cubes: Number(noOfCubes),
        lab_id: castLabId ? Number(castLabId) : null,
      });
      setShowCast(false);
      setPourId(''); setCastDate(''); setNoOfCubes('3'); setCastLabId(''); setSampleRef('');
      void load();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to cast cube sample.'));
    } finally {
      setCasting(false);
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedId((cur) => (cur === id ? null : id));
    setAge('28'); setTestDate(''); setObserved('');
  };

  const expandedSample = useMemo(
    () => samples.find((s) => s.sample_id === expandedId) ?? null,
    [samples, expandedId],
  );

  // Client-side preview of the required strength (server is authoritative).
  const requiredHint = useMemo(() => {
    const fck = expandedSample?.grade_min_strength_mpa;
    if (fck == null) return null;
    return Math.round(fck * (AGE_FRACTION[Number(age)] ?? 1) * 100) / 100;
  }, [expandedSample, age]);

  const handleRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (expandedId == null) return;
    setError(null);
    setRecording(true);
    try {
      await cubeTestsApi.recordTest(pid, expandedId, {
        test_age_days: Number(age),
        test_date: testDate,
        observed_strength_mpa: Number(observed),
      });
      setTestDate(''); setObserved('');
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to record test result.'));
    } finally {
      setRecording(false);
    }
  };

  const location = (s: CubeSampleResponse) =>
    [s.tower_name, s.floor_label, s.component_type].filter(Boolean).join(' · ') || '—';

  return (
    <div>
      <div className="qms-page-header-block">
        <div>
          <h2 className="qms-section-heading-plain">Cube tests</h2>
          <p className="qms-page-subtitle">
            Cube samples cast from pours and their IS 456 strength results
          </p>
        </div>
        {isQE && (
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setShowCast((s) => !s)}>
            Cast sample
          </Button>
        )}
      </div>

      {error && errorBox(error)}

      {isQE && showCast && (
        <Card className="qms-form-section">
          <form onSubmit={handleCast}>
            <h3 className="qms-section-heading">Cast a cube sample</h3>
            <div className="qms-grid-3">
              <Select
                label="Pour"
                required
                value={pourId}
                onChange={(e) => setPourId(e.target.value)}
                options={[
                  { label: pours.length ? 'Select pour…' : 'No pours yet — raise one first', value: '' },
                  ...pours.map((p) => ({
                    label: `${p.pour_reference ?? `PC-${p.pour_id}`} · ${p.grade_name ?? '—'} · ${[p.tower_name, p.floor_label].filter(Boolean).join(' ')}`,
                    value: p.pour_id,
                  })),
                ]}
              />
              <Input
                label="Sample reference"
                value={sampleRef}
                onChange={(e) => setSampleRef(e.target.value)}
                placeholder="e.g. CS-001"
              />
              <Input
                label="Cast date"
                type="date"
                required
                value={castDate}
                onChange={(e) => setCastDate(e.target.value)}
              />
              <Input
                label="No. of cubes"
                type="number"
                min="1"
                required
                value={noOfCubes}
                onChange={(e) => setNoOfCubes(e.target.value)}
              />
              <Select
                label="Lab (optional)"
                value={castLabId}
                onChange={(e) => setCastLabId(e.target.value)}
                options={[
                  { label: 'Not assigned yet', value: '' },
                  ...labs.map((l) => ({ label: l.lab_name, value: l.lab_id })),
                ]}
              />
            </div>
            <div className="qms-form-actions" style={{ marginTop: 12 }}>
              <Button type="button" variant="outline" onClick={() => setShowCast(false)}>Cancel</Button>
              <Button type="submit" variant="primary" disabled={casting || !canCast}>
                {casting ? 'Saving…' : 'Cast sample'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="qms-form-section" padding="none">
        <div className="qms-table-container">
          <table className="qms-table">
            <thead>
              <tr>
                <th style={{ width: 32 }}></th>
                <th>Sample</th><th>Location</th><th>Grade</th>
                <th>Cast date</th><th>Lab</th><th>Result</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-muted">Loading…</td></tr>
              ) : samples.length === 0 ? (
                <tr><td colSpan={7} className="text-muted">No cube samples yet.</td></tr>
              ) : (
                samples.map((s) => {
                  const worst = worstResult(s.tests);
                  const open = expandedId === s.sample_id;
                  return (
                    <React.Fragment key={s.sample_id}>
                      <tr style={{ cursor: 'pointer' }} onClick={() => toggleExpand(s.sample_id)}>
                        <td>{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</td>
                        <td className="font-medium">{s.sample_reference ?? `CS-${s.sample_id}`}</td>
                        <td>{location(s)}</td>
                        <td>{s.grade_name ?? '—'}</td>
                        <td>{fmtDate(s.cast_date)}</td>
                        <td>{s.lab_name ?? '—'}</td>
                        <td>
                          {worst
                            ? <Badge variant={RESULT_VARIANT[worst]}>{RESULT_LABEL[worst]}</Badge>
                            : <span className="text-muted">No result</span>}
                        </td>
                      </tr>
                      {open && (
                        <tr>
                          <td colSpan={7} style={{ background: 'var(--gray-50, #F9FAFB)' }}>
                            <SampleDetail
                              sample={s}
                              isQE={!!isQE}
                              age={age} setAge={setAge}
                              testDate={testDate} setTestDate={setTestDate}
                              observed={observed} setObserved={setObserved}
                              requiredHint={requiredHint}
                              recording={recording}
                              onRecord={handleRecord}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

interface DetailProps {
  sample: CubeSampleResponse;
  isQE: boolean;
  age: string; setAge: (v: string) => void;
  testDate: string; setTestDate: (v: string) => void;
  observed: string; setObserved: (v: string) => void;
  requiredHint: number | null;
  recording: boolean;
  onRecord: (e: React.FormEvent) => void;
}

const SampleDetail: React.FC<DetailProps> = ({
  sample, isQE, age, setAge, testDate, setTestDate, observed, setObserved,
  requiredHint, recording, onRecord,
}) => (
  <div style={{ padding: '12px 8px' }}>
    {sample.tests.length === 0 ? (
      <p className="text-muted" style={{ margin: '4px 0 12px' }}>No results recorded yet.</p>
    ) : (
      <table className="qms-table" style={{ marginBottom: 12 }}>
        <thead>
          <tr><th>Age</th><th>Test date</th><th>Observed</th><th>Required</th><th>Result</th><th>NCR</th></tr>
        </thead>
        <tbody>
          {sample.tests.map((t) => (
            <tr key={t.test_id}>
              <td>{t.test_age_days}-day</td>
              <td>{fmtDate(t.test_date)}</td>
              <td className="font-medium">{t.observed_strength_mpa} MPa</td>
              <td>{t.required_strength_mpa} MPa</td>
              <td><Badge variant={RESULT_VARIANT[t.result_status]}>{RESULT_LABEL[t.result_status]}</Badge></td>
              <td>
                {t.ncr_id
                  ? <span className="text-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13 }}><AlertTriangle size={13} /> {t.ncr_number}</span>
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )}

    {isQE && (
      <form onSubmit={onRecord}>
        <div className="qms-grid-3" style={{ alignItems: 'end' }}>
          <Select
            label="Test age"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            options={AGE_OPTIONS.map((a) => ({ label: `${a}-day`, value: a }))}
          />
          <Input
            label="Test date"
            type="date"
            required
            value={testDate}
            onChange={(e) => setTestDate(e.target.value)}
          />
          <Input
            label={`Observed strength (MPa)${requiredHint != null ? ` · needs ≈ ${requiredHint}` : ''}`}
            type="number"
            step="0.1"
            min="0"
            required
            value={observed}
            onChange={(e) => setObserved(e.target.value)}
          />
        </div>
        <div className="qms-form-actions" style={{ marginTop: 12 }}>
          <Button type="submit" variant="primary" size="sm" icon={<TestTube size={14} />}
            disabled={recording || testDate === '' || observed === ''}>
            {recording ? 'Saving…' : 'Record result'}
          </Button>
        </div>
        <p className="qms-text-sm text-muted" style={{ marginTop: 8 }}>
          A result below the required strength auto-raises an NCR (critical below 85%).
        </p>
      </form>
    )}
  </div>
);
