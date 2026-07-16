import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Send, Copy, Check, ClipboardCheck } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import { ErrorBox } from '../../components/ui/ErrorBox';
import { useProject } from '../../components/layout/ProjectLayout';
import { getApiErrorMessage } from '../../api/client';
import { toast } from '../../lib/toast';
import { useCreateDispatch, useDispatches, useResendDispatch } from '../../queries/dispatches';
import { useApprovedGrades } from '../../queries/mixDesigns';
import { useSuppliers } from '../../queries/suppliers';
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
  const navigate = useNavigate();
  const pid = project.project_id;
  const isQE = project.access.project_role === 'QUALITY_ENGINEER';

  const dispatchesQuery = useDispatches(pid);
  const rows = dispatchesQuery.data ?? [];
  const { data: suppliers = [] } = useSuppliers(pid);
  const { data: grades = [] } = useApprovedGrades(pid);
  const createDispatch = useCreateDispatch(pid);
  const resend = useResendDispatch(pid);

  const [showForm, setShowForm] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [gradeId, setGradeId] = useState('');
  const [volume, setVolume] = useState('');
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Only usable RMCs: not blocked, and (if client-registered) contractor-approved.
  const openSuppliers = suppliers.filter(
    (s) => !s.is_blocked && (s.approval_status === 'NOT_REQUIRED' || s.approval_status === 'ACCEPTED'),
  );
  const canSubmit = supplierId !== '' && gradeId !== '' && volume.trim() !== '' && Number(volume) > 0;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    try {
      await createDispatch.mutateAsync({
        supplier_id: Number(supplierId),
        grade_id: Number(gradeId),
        volume_ordered_cum: Number(volume),
      });
      toast.success('Dispatch request sent to the supplier.');
      setShowForm(false);
      setSupplierId('');
      setGradeId('');
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
      {isQE && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setShowForm((s) => !s)}>
            New dispatch
          </Button>
        </div>
      )}

      {dispatchesQuery.error && <ErrorBox>{getApiErrorMessage(dispatchesQuery.error, 'Unable to load dispatches.')}</ErrorBox>}

      {isQE && showForm && (
        <Card className="qms-form-section">
          <form onSubmit={handleCreate}>
            <h3 className="qms-section-heading">Request a truck</h3>
            <div className="qms-grid-3">
              <Select
                label="RMC supplier"
                required
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                options={[
                  { label: openSuppliers.length ? 'Select supplier…' : 'No suppliers yet', value: '' },
                  ...openSuppliers.map((s) => ({ label: s.supplier_name, value: s.supplier_id })),
                ]}
              />
              <Select
                label="Grade"
                required
                value={gradeId}
                onChange={(e) => setGradeId(e.target.value)}
                options={[
                  { label: grades.length ? 'Select grade…' : 'No approved mix designs — approve one first', value: '' },
                  ...grades.map((g) => ({ label: g.grade_name, value: g.grade_id })),
                ]}
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
            <p className="qms-text-sm text-muted qms-mt-8">
              The supplier is emailed a link to fill in the truck details — no login needed.
              Once the delivery is accepted, record the pour from it.
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
                rows.map((d) => {
                  const canRecordPour = d.truck?.status === 'ACCEPTED' && d.pour_id == null;
                  return (
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
                          {canRecordPour && (
                            <Button variant="ghost" size="sm" icon={<ClipboardCheck size={14} />}
                              onClick={() => navigate(`/app/projects/${pid}/pours/new?dispatch=${d.dispatch_id}`)}>
                              Record pour
                            </Button>
                          )}
                          {d.pour_id != null && <span className="qms-text-sm text-muted">Poured</span>}
                        </td>
                      )}
                    </tr>
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
