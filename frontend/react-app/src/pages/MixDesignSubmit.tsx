// Public, passwordless mix-design submission page for RMC suppliers.
//
// Reached from the request email {FRONTEND_URL}/external/mix-design?token=...
// The RMC submits one detailed mix design per grade the contractor requested;
// each lands as PENDING for the project's quality engineer to review. No login
// is needed — the token is the credential. See backend/app/routers/mix_submission.py.

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FlaskConical, Layers } from 'lucide-react';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { mixSubmissionApi } from '../api/mixSubmission';
import { getApiErrorMessage } from '../api/client';
import { num } from '../lib/coerce';
import type { MixApprovalStatus, MixSubmissionView } from '../types/master';
import './LoginPage.css';

const STATUS_VARIANT: Record<MixApprovalStatus, 'pass' | 'fail' | 'warn' | 'pending'> = {
  APPROVED: 'pass', REJECTED: 'fail', IN_PROGRESS: 'warn', PENDING: 'pending',
};

const NUM_FIELDS = [
  ['cement_kg', 'Cement kg/m³'],
  ['flyash_kg', 'Fly ash kg/m³'],
  ['ggbs_kg', 'GGBS kg/m³'],
  ['total_binder_kg', 'Total binder kg/m³'],
  ['wc_ratio', 'w/c ratio'],
  ['free_water_l', 'Free water lit/m³'],
  ['coarse_20mm_kg', 'Coarse agg 20mm kg'],
  ['coarse_10mm_kg', 'Coarse agg 10mm kg'],
  ['fine_agg_kg', 'Fine aggregate kg'],
  ['admixture_pct', 'Admixture dosage %'],
  ['target_mean_strength_mpa', 'Target mean strength MPa'],
] as const;

export const MixDesignSubmit: React.FC = () => {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<MixSubmissionView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [gradeId, setGradeId] = useState('');
  const [text, setText] = useState<Record<string, string>>({});
  const [file, setFile] = useState<File | null>(null);
  const set = (k: string, v: string) => setText((t) => ({ ...t, [k]: v }));

  useEffect(() => {
    if (!token) {
      setError('This mix-design link is invalid.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const v = await mixSubmissionApi.view(token);
        if (!cancelled) {
          setView(v);
          if (v.required_grades[0]) setGradeId(String(v.required_grades[0].grade_id));
        }
      } catch (err) {
        if (!cancelled) setError(getApiErrorMessage(err, 'This mix-design link is invalid or has expired.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const selected = useMemo(
    () => view?.required_grades.find((g) => String(g.grade_id) === gradeId) ?? null,
    [view, gradeId],
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradeId) return;
    if (!file) {
      setError('Attach the mix-design PDF — it is required.');
      return;
    }
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await mixSubmissionApi.submit(token, {
        grade_id: Number(gradeId),
        mix_design_ref: text.mix_design_ref || null,
        mix_type: text.mix_type || null,
        exposure_condition: text.exposure_condition || null,
        cement_type: (text.cement_type as 'OPC_43' | 'OPC_53') || null,
        max_aggregate_size_mm: num(text.max_aggregate_size_mm),
        slump_range_mm: text.slump_range_mm || null,
        admixture_brand: text.admixture_brand || null,
        ...Object.fromEntries(NUM_FIELDS.map(([k]) => [k, num(text[k])])),
      }, file);
      setNotice('Mix design submitted — the quality engineer will review it.');
      setText({});
      setFile(null);
      setView(await mixSubmissionApi.view(token));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not submit the mix design. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="qms-auth-page">
      <div className="qms-auth-card" style={{ maxWidth: 760 }}>
        <div className="qms-auth-brand">
          <div className="qms-auth-mark" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <Layers size={22} />
          </div>
          <h1 className="qms-auth-title">Mix design submission</h1>
        </div>

        {loading ? (
          <p className="text-muted" style={{ textAlign: 'center' }}>Loading…</p>
        ) : !view ? (
          <div className="qms-auth-error">{error ?? 'This mix-design link is invalid.'}</div>
        ) : (
          <>
            <p className="qms-auth-sub" style={{ marginBottom: 16 }}>
              <strong>{view.registered_by ?? 'A contractor'}</strong> requested mix
              designs from <strong>{view.supplier_name}</strong> for project{' '}
              <strong>{view.project_name ?? ''}</strong>. Submit one per grade below.
            </p>

            {error && <div className="qms-auth-error">{error}</div>}
            {notice && (
              <div className="qms-auth-error" style={{ background: '#DCFCE7', color: '#166534', borderColor: '#86EFAC' }}>
                {notice}
              </div>
            )}

            {view.required_grades.length === 0 ? (
              <p className="text-muted">No grades have been requested yet.</p>
            ) : (
              <form onSubmit={submit} noValidate>
                <div className="qms-grid-2">
                  <Select
                    label="Concrete grade"
                    required
                    value={gradeId}
                    onChange={(e) => setGradeId(e.target.value)}
                    options={view.required_grades.map((g) => ({
                      label: g.grade_name ?? `Grade #${g.grade_id}`,
                      value: g.grade_id,
                    }))}
                  />
                  <Input label="Mix design ID" placeholder="e.g. MIX-001" value={text.mix_design_ref ?? ''} onChange={(e) => set('mix_design_ref', e.target.value)} />
                </div>

                {selected?.approval_status && (
                  <p className="qms-text-sm" style={{ margin: '4px 0 12px' }}>
                    Current status:{' '}
                    <Badge variant={STATUS_VARIANT[selected.approval_status]}>
                      {selected.approval_status.replace('_', ' ')}
                    </Badge>{' '}
                    <span className="text-muted">— resubmitting replaces it and resets review.</span>
                  </p>
                )}

                <div className="qms-grid-2">
                  <Select label="Mix type" value={text.mix_type ?? ''} onChange={(e) => set('mix_type', e.target.value)}
                    options={[{ label: 'Select…', value: '' }, { label: 'Design Mix', value: 'Design Mix' }, { label: 'Nominal Mix', value: 'Nominal Mix' }]} />
                  <Select label="Exposure condition" value={text.exposure_condition ?? ''} onChange={(e) => set('exposure_condition', e.target.value)}
                    options={[{ label: 'Select…', value: '' }, 'Mild', 'Moderate', 'Severe', 'Very Severe', 'Extreme'].map((o) => typeof o === 'string' ? { label: o, value: o } : o)} />
                  <Select label="Cement type" value={text.cement_type ?? ''} onChange={(e) => set('cement_type', e.target.value)}
                    options={[{ label: 'Select…', value: '' }, { label: 'OPC 43', value: 'OPC_43' }, { label: 'OPC 53', value: 'OPC_53' }]} />
                  <Select label="Max aggregate size (mm)" value={text.max_aggregate_size_mm ?? ''} onChange={(e) => set('max_aggregate_size_mm', e.target.value)}
                    options={[{ label: 'Select…', value: '' }, { label: '10', value: '10' }, { label: '20', value: '20' }, { label: '40', value: '40' }]} />
                  {NUM_FIELDS.map(([k, label]) => (
                    <Input key={k} label={label} type="number" step="0.01" value={text[k] ?? ''} onChange={(e) => set(k, e.target.value)} />
                  ))}
                  <Input label="Admixture brand" value={text.admixture_brand ?? ''} onChange={(e) => set('admixture_brand', e.target.value)} />
                  <Input label="Slump range mm" placeholder="e.g. 100-150" value={text.slump_range_mm ?? ''} onChange={(e) => set('slump_range_mm', e.target.value)} />
                </div>

                <label className="qms-input-label" style={{ display: 'block', marginTop: 8 }}>
                  Mix design PDF (required)
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    style={{ display: 'block', marginTop: 4 }}
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </label>

                <Button type="submit" variant="primary" fullWidth icon={<FlaskConical size={16} />} disabled={busy || !gradeId || !file} style={{ marginTop: 12 }}>
                  {busy ? 'Submitting…' : 'Submit mix design'}
                </Button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
};
