import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Send, Copy, Check } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import { useProject } from '../../components/layout/ProjectLayout';
import { useAuth } from '../../hooks/useAuth';
import { dispatchesApi } from '../../api/dispatches';
import { poursApi } from '../../api/pours';
import { getApiErrorMessage } from '../../api/client';
import type { DispatchResponse, PourResponse, TruckStatus } from '../../types/master';

const TRUCK_VARIANT: Record<TruckStatus, 'pass' | 'fail' | 'warn' | 'info' | 'pending'> = {
  PENDING: 'pending', FILLED: 'info', ARRIVED: 'warn', ACCEPTED: 'pass', REJECTED: 'fail',
};
const TRUCK_LABEL: Record<TruckStatus, string> = {
  PENDING: 'Awaiting truck', FILLED: 'Filled at plant', ARRIVED: 'At gate', ACCEPTED: 'Accepted', REJECTED: 'Rejected',
};

const fillLink = (token: string) => `${window.location.origin}/dispatch/fill?token=${token}`;
const vol = (v: number | null) => (v != null ? `${v} m³` : '—');

const errorBox = (msg: string) => (
  <div style={{ padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 14, background: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5' }}>
    {msg}
  </div>
);

export const ProjectDispatches: React.FC = () => {
  const { project } = useProject();
  const { user } = useAuth();
  const pid = project.project_id;
  const isQE = user?.role === 'QUALITY_ENGINEER';

  const [rows, setRows] = useState<DispatchResponse[]>([]);
  const [pours, setPours] = useState<PourResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [pourId, setPourId] = useState('');
  const [volume, setVolume] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resendingId, setResendingId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, p] = await Promise.all([dispatchesApi.list(pid), poursApi.list(pid)]);
      setRows(d);
      setPours(p);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to load dispatches.'));
    } finally {
      setLoading(false);
    }
  }, [pid]);

  useEffect(() => { void load(); }, [load]);

  // A dispatch carries the supplier + grade of its pour, so picking the pour is
  // all the QE needs — they just add the ordered volume.
  const selectedPour = useMemo(
    () => pours.find((p) => p.pour_id === Number(pourId)) ?? null,
    [pours, pourId],
  );

  const canSubmit = selectedPour !== null && volume.trim() !== '' && Number(volume) > 0;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPour) return;
    setError(null);
    setSubmitting(true);
    try {
      await dispatchesApi.create(pid, {
        pour_id: selectedPour.pour_id,
        supplier_id: selectedPour.supplier_horizontal_id,
        grade_id: selectedPour.grade_id,
        volume_ordered_cum: Number(volume),
      });
      setShowForm(false);
      setPourId('');
      setVolume('');
      void load();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to raise dispatch.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async (d: DispatchResponse) => {
    setError(null);
    setResendingId(d.dispatch_id);
    try {
      await dispatchesApi.resend(pid, d.dispatch_id);
      void load();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to resend the dispatch link.'));
    } finally {
      setResendingId(null);
    }
  };

  const handleCopy = async (d: DispatchResponse) => {
    if (!d.truck) return;
    await navigator.clipboard.writeText(fillLink(d.truck.token));
    setCopiedId(d.dispatch_id);
    setTimeout(() => setCopiedId((c) => (c === d.dispatch_id ? null : c)), 1500);
  };

  return (
    <div>
      <div className="qms-page-header-block">
        <div>
          <h2 className="qms-section-heading-plain">Dispatches</h2>
          <p className="qms-page-subtitle">RMC truck dispatches and their delivery status</p>
        </div>
        {isQE && (
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setShowForm((s) => !s)}>
            New dispatch
          </Button>
        )}
      </div>

      {error && errorBox(error)}

      {isQE && showForm && (
        <Card className="qms-form-section">
          <form onSubmit={handleCreate}>
            <h3 className="qms-section-heading">Request a truck</h3>
            <div className="qms-grid-3">
              <Select
                label="Pour"
                required
                value={pourId}
                onChange={(e) => setPourId(e.target.value)}
                options={[
                  { label: pours.length ? 'Select pour…' : 'No pours yet — raise one first', value: '' },
                  ...pours.map((p) => ({
                    label: `${p.pour_reference ?? `PC-${p.pour_id}`} · ${p.grade_name ?? '—'} · ${p.supplier_name ?? '—'}`,
                    value: p.pour_id,
                  })),
                ]}
              />
              <Input
                label="Grade / supplier"
                value={selectedPour ? `${selectedPour.grade_name ?? '—'} — ${selectedPour.supplier_name ?? '—'}` : ''}
                placeholder="Set by the pour"
                disabled
              />
              <Input
                label="Volume ordered (m³)"
                type="number"
                step="0.5"
                min="0"
                required
                value={volume}
                onChange={(e) => setVolume(e.target.value)}
              />
            </div>
            <p className="qms-text-sm text-muted" style={{ marginTop: 8 }}>
              The supplier is emailed a link to fill in the truck details — no login needed.
            </p>
            <div className="qms-form-actions" style={{ marginTop: 12 }}>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" variant="primary" disabled={submitting || !canSubmit}>
                {submitting ? 'Sending…' : 'Send dispatch request'}
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
                <th>Supplier</th><th>Grade</th><th>Ordered</th><th>Received</th>
                <th>Vehicle</th><th>Status</th>{isQE && <th></th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={isQE ? 7 : 6} className="text-muted">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={isQE ? 7 : 6} className="text-muted">No dispatches yet.</td></tr>
              ) : (
                rows.map((d) => (
                  <tr key={d.dispatch_id}>
                    <td className="font-medium">{d.supplier_name ?? '—'}</td>
                    <td>{d.grade_name ?? '—'}</td>
                    <td>{vol(d.volume_ordered_cum)}</td>
                    <td>{vol(d.volume_received_cum)}</td>
                    <td>{d.truck?.vehicle_number ?? '—'}</td>
                    <td>
                      {d.truck
                        ? <Badge variant={TRUCK_VARIANT[d.truck.status]}>{TRUCK_LABEL[d.truck.status]}</Badge>
                        : '—'}
                    </td>
                    {isQE && (
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {d.truck?.status === 'PENDING' && (
                          <>
                            <Button variant="ghost" size="sm" icon={copiedId === d.dispatch_id ? <Check size={14} /> : <Copy size={14} />} onClick={() => handleCopy(d)}>
                              {copiedId === d.dispatch_id ? 'Copied' : 'Link'}
                            </Button>
                            <Button variant="ghost" size="sm" icon={<Send size={14} />} disabled={resendingId === d.dispatch_id} onClick={() => handleResend(d)}>
                              {resendingId === d.dispatch_id ? 'Sending…' : 'Resend'}
                            </Button>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
