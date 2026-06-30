import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Send, Copy, Check } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import { ErrorBox } from '../../components/ui/ErrorBox';
import { useProject } from '../../components/layout/ProjectLayout';
import { useAuth } from '../../hooks/useAuth';
import { getApiErrorMessage } from '../../api/client';
import { toast } from '../../lib/toast';
import { useCreateDispatch, useDispatches, useResendDispatch } from '../../queries/dispatches';
import { usePours } from '../../queries/pours';
import type { DispatchResponse, TruckStatus } from '../../types/master';

const TRUCK_VARIANT: Record<TruckStatus, 'pass' | 'fail' | 'warn' | 'info' | 'pending'> = {
  PENDING: 'pending', FILLED: 'info', ARRIVED: 'warn', PENDING_QE: 'warn', ACCEPTED: 'pass', REJECTED: 'fail',
};
const TRUCK_LABEL: Record<TruckStatus, string> = {
  PENDING: 'Awaiting truck', FILLED: 'Filled at plant', ARRIVED: 'At gate',
  PENDING_QE: 'Awaiting QE', ACCEPTED: 'Accepted', REJECTED: 'Rejected',
};

const fillLink = (token: string) => `${window.location.origin}/dispatch/fill?token=${token}`;
const vol = (v: number | null) => (v != null ? `${v} m³` : '—');

export const ProjectDispatches: React.FC = () => {
  const { project } = useProject();
  const { user } = useAuth();
  const pid = project.project_id;
  const isQE = user?.role === 'QUALITY_ENGINEER';

  const dispatchesQuery = useDispatches(pid);
  const rows = dispatchesQuery.data ?? [];
  const { data: pours = [] } = usePours(pid);
  const createDispatch = useCreateDispatch(pid);
  const resend = useResendDispatch(pid);

  const [showForm, setShowForm] = useState(false);
  const [pourId, setPourId] = useState('');
  const [volume, setVolume] = useState('');
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Only pours that still need concrete can be dispatched to — a completed pour
  // is done, so it drops out of the picker.
  const openPours = useMemo(
    () => pours.filter((p) => p.status !== 'COMPLETED' && p.status !== 'CANCELLED'),
    [pours],
  );

  // A dispatch carries the supplier + grade of its pour, so picking the pour is
  // all the QE needs — they just add the ordered volume.
  const selectedPour = useMemo(
    () => pours.find((p) => p.pour_id === Number(pourId)) ?? null,
    [pours, pourId],
  );

  // Auto-fill the order with the pour's remaining volume (planned − delivered −
  // outstanding) so the QE just confirms it. They can still override.
  useEffect(() => {
    if (selectedPour?.volume_remaining_cum != null) {
      setVolume(String(selectedPour.volume_remaining_cum));
    }
  }, [selectedPour]);

  const canSubmit = selectedPour !== null && volume.trim() !== '' && Number(volume) > 0;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPour) return;
    try {
      await createDispatch.mutateAsync({
        pour_id: selectedPour.pour_id,
        supplier_id: selectedPour.supplier_horizontal_id,
        grade_id: selectedPour.grade_id,
        volume_ordered_cum: Number(volume),
      });
      toast.success('Dispatch request sent to the supplier.');
      setShowForm(false);
      setPourId('');
      setVolume('');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Unable to raise dispatch.'));
    }
  };

  const handleResend = async (d: DispatchResponse) => {
    try {
      await resend.mutateAsync(d.dispatch_id);
      toast.success('Dispatch link re-sent.');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Unable to resend the dispatch link.'));
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

      {dispatchesQuery.error && <ErrorBox>{getApiErrorMessage(dispatchesQuery.error, 'Unable to load dispatches.')}</ErrorBox>}

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
                  { label: openPours.length ? 'Select pour…' : 'No open pours — raise one first', value: '' },
                  ...openPours.map((p) => ({
                    label: `${p.pour_reference ?? `PC-${p.pour_id}`} · ${p.grade_name ?? '—'} · ${p.supplier_name ?? '—'}`
                      + (p.volume_remaining_cum != null ? ` · ${p.volume_remaining_cum} m³ left` : ''),
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
                label={`Volume ordered (m³)${selectedPour?.volume_remaining_cum != null ? ` · ${selectedPour.volume_remaining_cum} left on this pour` : ''}`}
                type="number"
                step="0.5"
                min="0"
                required
                value={volume}
                onChange={(e) => setVolume(e.target.value)}
              />
            </div>
            <p className="qms-text-sm text-muted qms-mt-8">
              The supplier is emailed a link to fill in the truck details — no login needed.
            </p>
            <div className="qms-form-actions">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" variant="primary" disabled={createDispatch.isPending || !canSubmit}>
                {createDispatch.isPending ? 'Sending…' : 'Send dispatch request'}
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
              {dispatchesQuery.isPending ? (
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
                      <td className="qms-nowrap">
                        {d.truck?.status === 'PENDING' && (
                          <>
                            <Button variant="ghost" size="sm" icon={copiedId === d.dispatch_id ? <Check size={14} /> : <Copy size={14} />} onClick={() => handleCopy(d)}>
                              {copiedId === d.dispatch_id ? 'Copied' : 'Link'}
                            </Button>
                            <Button variant="ghost" size="sm" icon={<Send size={14} />}
                              disabled={resend.isPending && resend.variables === d.dispatch_id}
                              onClick={() => handleResend(d)}>
                              {resend.isPending && resend.variables === d.dispatch_id ? 'Sending…' : 'Resend'}
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
