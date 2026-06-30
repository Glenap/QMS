// Site gate — the Supervisor scans an arriving RMC truck in by its dispatch
// token, reviews what the supplier filled at the plant, then accepts or rejects
// the delivery. Wired to /projects/{id}/gate/{token}. SUPERVISOR only.

import React, { useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ScanLine, Truck, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { useAuth } from '../../hooks/useAuth';
import { useProject } from '../../components/layout/ProjectLayout';
import { dispatchesApi } from '../../api/dispatches';
import { getApiErrorMessage } from '../../api/client';
import { num } from '../../lib/coerce';
import type { GateTruckView, TruckStatus } from '../../types/master';
import './GateScan.css';

const TRUCK_VARIANT: Record<TruckStatus, 'pass' | 'fail' | 'warn' | 'info' | 'pending'> = {
  PENDING: 'pending', FILLED: 'info', ARRIVED: 'warn', PENDING_QE: 'warn', ACCEPTED: 'pass', REJECTED: 'fail',
};
const TRUCK_LABEL: Record<TruckStatus, string> = {
  PENDING: 'Awaiting truck', FILLED: 'Filled at plant', ARRIVED: 'At gate',
  PENDING_QE: 'Awaiting QE sign-off', ACCEPTED: 'Accepted', REJECTED: 'Rejected',
};
const ACTION_REASONS = [
  { value: 'GRADE_MISMATCH', label: 'Grade mismatch' },
  { value: 'SLUMP_MISMATCH', label: 'Slump mismatch' },
  { value: 'VOLUME_MISMATCH', label: 'Volume mismatch' },
  { value: 'OTHER', label: 'Other' },
] as const;

const row = (label: string, value: React.ReactNode) => (
  <div className="qms-td-row">
    <span className="text-muted">{label}</span>
    <span className="font-medium">{value}</span>
  </div>
);

// Is the load past its concrete placement window (dispatch → gate)?
const isPastWindow = (v: GateTruckView): boolean =>
  v.transit_minutes != null &&
  v.placement_window_minutes != null &&
  v.transit_minutes > v.placement_window_minutes;

const transitValue = (v: GateTruckView): React.ReactNode => {
  if (v.transit_minutes == null || v.placement_window_minutes == null) return '—';
  const over = isPastWindow(v);
  return (
    <span style={{ color: over ? '#991B1B' : '#166534' }}>
      {v.transit_minutes} min / {v.placement_window_minutes} min window
    </span>
  );
};

const schema = z.object({
  token: z.string().min(1, 'Enter a dispatch token'),
  slump_at_site_mm: z.string(),
  rejection_reason: z.string(),
  action_reason: z.enum(['GRADE_MISMATCH', 'SLUMP_MISMATCH', 'VOLUME_MISMATCH', 'OTHER']),
  action_message: z.string(),
});
type FormValues = z.infer<typeof schema>;

export const GateScan: React.FC = () => {
  const { user } = useAuth();
  const { project } = useProject();
  const { projectId } = useParams();
  const pid = project.project_id;

  const [view, setView] = useState<GateTruckView | null>(null);
  const [showReject, setShowReject] = useState(false);
  const [showAction, setShowAction] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register, handleSubmit, control, getValues, reset: resetForm,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      token: '', slump_at_site_mm: '', rejection_reason: '',
      action_reason: 'SLUMP_MISMATCH', action_message: '',
    },
  });
  const tokenValue = useWatch({ control, name: 'token' });
  const rejectReason = useWatch({ control, name: 'rejection_reason' });
  const actionMessage = useWatch({ control, name: 'action_message' });

  // Gate scanning is done by the Supervisor.
  if (user && user.role !== 'SUPERVISOR') {
    return <Navigate to={`/app/projects/${projectId}`} replace />;
  }

  const run = async (fn: () => Promise<GateTruckView>) => {
    setError(null);
    setBusy(true);
    try {
      setView(await fn());
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not complete that action.'));
    } finally {
      setBusy(false);
    }
  };

  const lookup = (v: FormValues) => run(() => dispatchesApi.gateLookup(pid, v.token.trim()));

  const scanNext = () => {
    setView(null); setShowReject(false); setShowAction(false); setError(null); resetForm();
  };

  const t = view?.truck;

  return (
    <div className="qms-gatescan-page">
      <div className="qms-gatescan-header">
        <h1>Gate security scan</h1>
        <p>Scan or paste the truck's dispatch token to verify and admit the delivery</p>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 14, background: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5' }}>
          {error}
        </div>
      )}

      {!view ? (
        <Card className="qms-scanner-card">
          <form onSubmit={handleSubmit(lookup)} noValidate style={{ padding: 20 }}>
            <div style={{ textAlign: 'center', marginBottom: 16, color: 'var(--gray-500)' }}>
              <ScanLine size={40} />
              <p style={{ marginTop: 8, fontSize: 13 }}>Scan the QR on the RMC challan, or paste its token below.</p>
            </div>
            <Input label="Dispatch token" error={errors.token?.message} placeholder="Paste token…" {...register('token')} />
            <Button variant="primary" fullWidth disabled={busy || !tokenValue.trim()} type="submit" style={{ marginTop: 12 }}>
              {busy ? 'Looking up…' : 'Look up truck'}
            </Button>
          </form>
        </Card>
      ) : (
        <div className="qms-scan-result">
          <Card className="qms-truck-details">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span className="font-medium" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Truck size={18} /> {view.supplier_name ?? '—'}
              </span>
              {t && <Badge variant={TRUCK_VARIANT[t.status]}>{TRUCK_LABEL[t.status]}</Badge>}
            </div>
            {row('Project', view.project_name ?? '—')}
            {row('Grade', view.grade_name ?? '—')}
            {row('Vehicle no.', t?.vehicle_number ?? '—')}
            {row('Driver', t?.driver_name ?? '—')}
            {row('Challan no.', t?.challan_number ?? '—')}
            {row('Batch no.', t?.batch_number ?? '—')}
            {row('Volume in truck', t?.volume_cum != null ? `${t.volume_cum} m³` : '—')}
            {row('Slump at plant', t?.slump_at_plant_mm != null ? `${t.slump_at_plant_mm} mm` : '—')}
            {row('Ordered', view.volume_ordered_cum != null ? `${view.volume_ordered_cum} m³` : '—')}
            {row('In transit', transitValue(view))}
          </Card>

          {t?.status === 'FILLED' && (
            <Card className="qms-form-section">
              {isPastWindow(view) && (
                <div className="qms-alert-box" style={{ marginBottom: 12 }}>
                  <XCircle size={18} />
                  <div>
                    This load is past the {view.placement_window_minutes}-minute concrete
                    placement window. Scanning it in will <strong>auto-reject</strong> the
                    delivery.
                  </div>
                </div>
              )}
              <Input label="Slump at site (mm)" type="number" step="1" placeholder="Optional" {...register('slump_at_site_mm')} />
              <Button variant="primary" fullWidth disabled={busy} style={{ marginTop: 12 }}
                onClick={() => run(() => dispatchesApi.gateArrive(pid, t.token, { slump_at_site_mm: num(getValues('slump_at_site_mm')) ?? null }))}>
                {busy ? 'Recording…' : 'Scan in at gate'}
              </Button>
            </Card>
          )}

          {t?.status === 'ARRIVED' && !showReject && !showAction && (
            <>
              <div className="qms-form-actions">
                <Button variant="outline" icon={<XCircle size={16} />} style={{ flex: 1 }} disabled={busy} onClick={() => setShowReject(true)}>
                  Reject
                </Button>
                <Button variant="primary" icon={<CheckCircle size={16} />} style={{ flex: 2 }} disabled={busy}
                  onClick={() => run(() => dispatchesApi.gateAccept(pid, t.token))}>
                  {busy ? 'Saving…' : 'Admit (QE in-situ next)'}
                </Button>
              </div>
              <Button variant="ghost" fullWidth icon={<AlertTriangle size={16} />} disabled={busy}
                onClick={() => setShowAction(true)} style={{ marginTop: 8 }}>
                Flag a mismatch for the QE
              </Button>
            </>
          )}

          {t?.status === 'ARRIVED' && showAction && (
            <Card className="qms-form-section">
              <Select label="Mismatch type" {...register('action_reason')}
                options={ACTION_REASONS.map((r) => ({ label: r.label, value: r.value }))} />
              <Input label="What's the issue?" required placeholder="e.g. Challan says M25 but pour needs M30"
                {...register('action_message')} />
              <div className="qms-form-actions" style={{ marginTop: 12 }}>
                <Button type="button" variant="outline" style={{ flex: 1 }} onClick={() => setShowAction(false)}>Back</Button>
                <Button variant="primary" style={{ flex: 2 }} disabled={busy || !actionMessage.trim()}
                  onClick={() => run(() => dispatchesApi.gateActionRequired(pid, t.token, {
                    reason: getValues('action_reason'),
                    message: getValues('action_message').trim(),
                  }))}>
                  {busy ? 'Sending…' : 'Send to QE'}
                </Button>
              </div>
            </Card>
          )}

          {t?.status === 'ARRIVED' && showReject && (
            <Card className="qms-form-section">
              <Input label="Reason for rejection" required placeholder="e.g. Slump out of range, excess transit time" {...register('rejection_reason')} />
              <div className="qms-form-actions" style={{ marginTop: 12 }}>
                <Button type="button" variant="outline" style={{ flex: 1 }} onClick={() => setShowReject(false)}>Back</Button>
                <Button variant="primary" style={{ flex: 2 }} disabled={busy || !rejectReason.trim()}
                  onClick={() => run(() => dispatchesApi.gateReject(pid, t.token, { rejection_reason: getValues('rejection_reason').trim() }))}>
                  {busy ? 'Saving…' : 'Confirm rejection'}
                </Button>
              </div>
            </Card>
          )}

          {(t?.status === 'ACCEPTED' || t?.status === 'REJECTED') && (
            <div className={`qms-alert-box ${t.status === 'ACCEPTED' ? 'qms-alert--success' : ''}`}>
              {t.status === 'ACCEPTED' ? <CheckCircle size={18} /> : <XCircle size={18} />}
              <div>
                <strong>{t.status === 'ACCEPTED' ? 'Entry allowed' : 'Delivery rejected'}</strong>
                {t.rejection_reason && <div>{t.rejection_reason}</div>}
                <div>The supplier has been notified.</div>
              </div>
            </div>
          )}

          {t?.status === 'PENDING_QE' && (
            <div className="qms-alert-box">
              <CheckCircle size={18} />
              <div>
                <strong>Admitted — awaiting QE sign-off.</strong>
                <div>The quality engineer runs the in-situ slump test before this
                delivery is finally accepted and credited to the pour.</div>
              </div>
            </div>
          )}

          {t?.status === 'PENDING' && (
            <div className="qms-alert-box">
              <div>This truck hasn't been filled in by the supplier yet.</div>
            </div>
          )}

          <Button variant="outline" fullWidth onClick={scanNext} style={{ marginTop: 16 }}>
            Scan next vehicle
          </Button>
        </div>
      )}
    </div>
  );
};
