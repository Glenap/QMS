// Site gate — the Supervisor scans an arriving RMC truck in by its dispatch
// token, reviews what the supplier filled at the plant, then accepts or rejects
// the delivery. Wired to /projects/{id}/gate/{token}. SUPERVISOR only.

import React, { useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { ScanLine, Truck, CheckCircle, XCircle } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { useAuth } from '../hooks/useAuth';
import { useProject } from '../components/layout/ProjectLayout';
import { dispatchesApi } from '../api/dispatches';
import { getApiErrorMessage } from '../api/client';
import type { GateTruckView, TruckStatus } from '../types/master';
import './GateScan.css';

const TRUCK_VARIANT: Record<TruckStatus, 'pass' | 'fail' | 'warn' | 'info' | 'pending'> = {
  PENDING: 'pending', FILLED: 'info', ARRIVED: 'warn', ACCEPTED: 'pass', REJECTED: 'fail',
};
const TRUCK_LABEL: Record<TruckStatus, string> = {
  PENDING: 'Awaiting truck', FILLED: 'Filled at plant', ARRIVED: 'At gate', ACCEPTED: 'Accepted', REJECTED: 'Rejected',
};

const row = (label: string, value: React.ReactNode) => (
  <div className="qms-td-row">
    <span className="text-muted">{label}</span>
    <span className="font-medium">{value}</span>
  </div>
);

export const GateScan: React.FC = () => {
  const { user } = useAuth();
  const { project } = useProject();
  const { projectId } = useParams();
  const pid = project.project_id;

  const [token, setToken] = useState('');
  const [view, setView] = useState<GateTruckView | null>(null);
  const [siteSlump, setSiteSlump] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const lookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;
    await run(() => dispatchesApi.gateLookup(pid, token.trim()));
  };

  const reset = () => {
    setView(null); setToken(''); setSiteSlump(''); setRejectReason(''); setShowReject(false); setError(null);
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
          <form onSubmit={lookup} style={{ padding: 20 }}>
            <div style={{ textAlign: 'center', marginBottom: 16, color: 'var(--gray-500)' }}>
              <ScanLine size={40} />
              <p style={{ marginTop: 8, fontSize: 13 }}>Scan the QR on the RMC challan, or paste its token below.</p>
            </div>
            <Input label="Dispatch token" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Paste token…" />
            <Button variant="primary" fullWidth disabled={busy || !token.trim()} type="submit" style={{ marginTop: 12 }}>
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
          </Card>

          {t?.status === 'FILLED' && (
            <Card className="qms-form-section">
              <Input label="Slump at site (mm)" type="number" step="1" value={siteSlump} onChange={(e) => setSiteSlump(e.target.value)} placeholder="Optional" />
              <Button variant="primary" fullWidth disabled={busy} style={{ marginTop: 12 }}
                onClick={() => run(() => dispatchesApi.gateArrive(pid, t.token, { slump_at_site_mm: siteSlump.trim() ? Number(siteSlump) : null }))}>
                {busy ? 'Recording…' : 'Scan in at gate'}
              </Button>
            </Card>
          )}

          {t?.status === 'ARRIVED' && !showReject && (
            <div className="qms-form-actions">
              <Button variant="outline" icon={<XCircle size={16} />} style={{ flex: 1 }} disabled={busy} onClick={() => setShowReject(true)}>
                Reject
              </Button>
              <Button variant="primary" icon={<CheckCircle size={16} />} style={{ flex: 2 }} disabled={busy}
                onClick={() => run(() => dispatchesApi.gateAccept(pid, t.token))}>
                {busy ? 'Saving…' : 'Accept delivery'}
              </Button>
            </div>
          )}

          {t?.status === 'ARRIVED' && showReject && (
            <Card className="qms-form-section">
              <Input label="Reason for rejection" required value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="e.g. Slump out of range, excess transit time" />
              <div className="qms-form-actions" style={{ marginTop: 12 }}>
                <Button variant="outline" style={{ flex: 1 }} onClick={() => setShowReject(false)}>Back</Button>
                <Button variant="primary" style={{ flex: 2 }} disabled={busy || !rejectReason.trim()}
                  onClick={() => run(() => dispatchesApi.gateReject(pid, t.token, { rejection_reason: rejectReason.trim() }))}>
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

          {t?.status === 'PENDING' && (
            <div className="qms-alert-box">
              <div>This truck hasn't been filled in by the supplier yet.</div>
            </div>
          )}

          <Button variant="outline" fullWidth onClick={reset} style={{ marginTop: 16 }}>
            Scan next vehicle
          </Button>
        </div>
      )}
    </div>
  );
};
