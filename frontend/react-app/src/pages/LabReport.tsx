// Public, passwordless cube-report page for testing labs.
//
// Reached from the dispatch/reminder email {FRONTEND_URL}/external/lab-report?token=...
// The lab first establishes the testing day (anchoring the 7/14/28-day schedule),
// then submits each milestone strength report — optionally with a PDF — which
// lands straight in the project's cube results. No login required — the token is
// the credential. See backend/app/routers/lab_report.py.

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarCheck, FlaskConical, Layers, Upload } from 'lucide-react';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { labReportApi } from '../api/labReport';
import { getApiErrorMessage } from '../api/client';
import type { LabReportView } from '../types/master';
import { AGE_FRACTION, fmtDate, RESULT_LABEL, RESULT_VARIANT } from '../components/cube/cubeFormat';
import './LoginPage.css';

export const LabReport: React.FC = () => {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<LabReportView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [startDate, setStartDate] = useState('');
  const [receivedDate, setReceivedDate] = useState('');
  const [observed, setObserved] = useState<Record<number, string>>({});
  const [files, setFiles] = useState<Record<number, File | null>>({});
  const [busyAge, setBusyAge] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('This lab report link is invalid.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const v = await labReportApi.view(token);
        if (!cancelled) {
          setView(v);
          setStartDate(v.testing_started_on ?? v.cast_date ?? '');
          setReceivedDate(v.cube_received_on ?? v.cast_date ?? '');
        }
      } catch (err) {
        if (!cancelled) setError(getApiErrorMessage(err, 'This lab report link is invalid or has expired.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStarting(true);
    try {
      const v = await labReportApi.start(token, {
        testing_started_on: startDate,
        cube_received_on: receivedDate || null,
      });
      setView(v);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not set the testing day. Please try again.'));
    } finally {
      setStarting(false);
    }
  };

  const submit = async (age: number) => {
    if (!files[age]) {
      setError('Attach the signed report PDF — it is required.');
      return;
    }
    setError(null);
    setNotice(null);
    setBusyAge(age);
    try {
      const res = await labReportApi.submit(
        token,
        { test_age_days: age, observed_strength_mpa: Number(observed[age]) },
        files[age] ?? null,
      );
      setNotice(res.message);
      setObserved((o) => ({ ...o, [age]: '' }));
      setFiles((f) => ({ ...f, [age]: null }));
      setView(await labReportApi.view(token));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not submit the report. Please try again.'));
    } finally {
      setBusyAge(null);
    }
  };

  const requiredHint = (age: number): number | null => {
    const fck = view?.grade_min_strength_mpa;
    if (fck == null) return null;
    return Math.round(fck * (AGE_FRACTION[age] ?? 1) * 100) / 100;
  };

  return (
    <div className="qms-auth-page">
      <div className="qms-auth-card" style={{ maxWidth: 520 }}>
        <div className="qms-auth-brand">
          <div className="qms-auth-mark" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <Layers size={22} />
          </div>
          <h1 className="qms-auth-title">Cube strength reports</h1>
        </div>

        {loading ? (
          <p className="text-muted" style={{ textAlign: 'center' }}>Loading…</p>
        ) : !view ? (
          <div className="qms-auth-error">{error ?? 'This lab report link is invalid.'}</div>
        ) : (
          <>
            <p className="qms-auth-sub" style={{ marginBottom: 16 }}>
              <strong>{view.project_name ?? 'A project'}</strong> sent sample{' '}
              <strong>{view.sample_reference ?? ''}</strong>
              {view.grade_name ? <> (grade <strong>{view.grade_name}</strong>)</> : null}
              {' '}to <strong>{view.lab_name ?? 'your lab'}</strong>. Cast on{' '}
              {fmtDate(view.cast_date)} · {view.no_of_cubes ?? '—'} cubes.
            </p>

            {error && <div className="qms-auth-error">{error}</div>}
            {notice && (
              <div className="qms-auth-error" style={{ background: '#DCFCE7', color: '#166534', borderColor: '#86EFAC' }}>
                {notice}
              </div>
            )}

            {!view.testing_started_on ? (
              <form className="qms-auth-form" onSubmit={start} noValidate>
                <p className="qms-text-sm text-muted" style={{ marginBottom: 8 }}>
                  First, confirm when you received the cubes and the day
                  testing/curing started. This sets when the 7, 14 and 28-day
                  reports are due.
                </p>
                <Input
                  label="Cubes received on (optional)"
                  type="date"
                  value={receivedDate}
                  onChange={(e) => setReceivedDate(e.target.value)}
                />
                <Input
                  label="Testing start date"
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <Button type="submit" variant="primary" fullWidth icon={<CalendarCheck size={16} />} disabled={starting || !startDate}>
                  {starting ? 'Saving…' : 'Set testing day'}
                </Button>
              </form>
            ) : (
              <>
                <p className="qms-text-sm text-muted" style={{ marginBottom: 12 }}>
                  {view.cube_received_on ? <>Cubes received {fmtDate(view.cube_received_on)}. </> : null}
                  Testing started {fmtDate(view.testing_started_on)}. Submit each
                  report below when its cubes are tested.
                </p>
                {view.milestones.map((m) => (
                  <div key={m.test_age_days} className="qms-labreport-milestone">
                    <div className="qms-labreport-milestone-head">
                      <span className="font-medium">{m.test_age_days}-day report</span>
                      <span className="text-muted qms-text-sm">due {fmtDate(m.due_date)}</span>
                    </div>

                    {m.submitted ? (
                      <div className="qms-labreport-done">
                        <Badge variant={m.result_status ? RESULT_VARIANT[m.result_status] : 'pending'}>
                          {m.result_status ? RESULT_LABEL[m.result_status] : 'Submitted'}
                        </Badge>
                        <span className="qms-text-sm text-muted">
                          {m.observed_strength_mpa} MPa (required {m.required_strength_mpa} MPa)
                        </span>
                        {m.has_report_pdf && <span className="qms-text-sm text-muted">· PDF attached</span>}
                      </div>
                    ) : (
                      <div className="qms-labreport-form">
                        <Input
                          label={`Observed strength (MPa)${requiredHint(m.test_age_days) != null ? ` · needs ≈ ${requiredHint(m.test_age_days)}` : ''}`}
                          type="number"
                          step="0.1"
                          min="0"
                          value={observed[m.test_age_days] ?? ''}
                          onChange={(e) => setObserved((o) => ({ ...o, [m.test_age_days]: e.target.value }))}
                        />
                        <label className="qms-labreport-file">
                          <Upload size={14} /> {files[m.test_age_days]?.name ?? 'Attach signed report PDF (required)'}
                          <input
                            type="file"
                            accept="application/pdf,image/*"
                            onChange={(e) => setFiles((f) => ({ ...f, [m.test_age_days]: e.target.files?.[0] ?? null }))}
                          />
                        </label>
                        <Button
                          type="button" variant="primary" size="sm" icon={<FlaskConical size={14} />}
                          onClick={() => submit(m.test_age_days)}
                          disabled={busyAge === m.test_age_days || !observed[m.test_age_days] || !files[m.test_age_days]}
                        >
                          {busyAge === m.test_age_days ? 'Submitting…' : `Submit ${m.test_age_days}-day report`}
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
                <p className="qms-text-sm text-muted" style={{ marginTop: 12 }}>
                  The 28-day result is the acceptance test — a shortfall there raises
                  a non-conformance with the contractor.
                </p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};
