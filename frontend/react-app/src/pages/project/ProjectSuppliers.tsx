import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Plus, Mail } from 'lucide-react';
import { useProject } from '../../components/layout/ProjectLayout';
import { suppliersApi } from '../../api/suppliers';
import { getApiErrorMessage } from '../../api/client';
import type { ConfirmationStatus, SupplierCreate, SupplierResponse } from '../../types/master';

const str = (v: string): string | undefined => (v.trim() === '' ? undefined : v.trim());
const num = (v: string): number | undefined => {
  const t = v.trim();
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isNaN(n) ? undefined : n;
};

const CONF_VARIANT: Record<ConfirmationStatus, 'pass' | 'warn' | 'fail'> = {
  CONFIRMED: 'pass', PENDING: 'warn', DECLINED: 'fail',
};
const CONF_LABEL: Record<ConfirmationStatus, string> = {
  CONFIRMED: 'Confirmed', PENDING: 'Pending', DECLINED: 'Declined',
};

const EMPTY = { supplier_name: '', plant_name: '', gst_number: '', plant_location: '', plant_distance_km: '', contact_email: '', contact_phone: '' };

export const ProjectSuppliers: React.FC = () => {
  const { project } = useProject();
  const navigate = useNavigate();
  const pid = project.project_id;
  const canManage = project.access.can_manage_contractor_side;

  const [rows, setRows] = useState<SupplierResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ ...EMPTY });
  const [submitting, setSubmitting] = useState(false);
  const [resendingId, setResendingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await suppliersApi.list(pid));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to load suppliers.'));
    } finally {
      setLoading(false);
    }
  }, [pid]);

  useEffect(() => { void load(); }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setSuccess(null); setSubmitting(true);
    const payload: SupplierCreate = {
      supplier_name: form.supplier_name.trim(),
      plant_name: str(form.plant_name),
      gst_number: str(form.gst_number),
      plant_location: str(form.plant_location),
      plant_distance_km: num(form.plant_distance_km),
      contact_email: str(form.contact_email),
      contact_phone: str(form.contact_phone),
    };
    try {
      const s = await suppliersApi.create(pid, payload);
      setSuccess(
        s.contact_email
          ? `Supplier "${s.supplier_name}" registered — a confirmation email was sent to ${s.contact_email}.`
          : `Supplier "${s.supplier_name}" registered. Add a contact email to send a confirmation request.`,
      );
      setForm({ ...EMPTY });
      setShowForm(false);
      void load();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to register supplier.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async (s: SupplierResponse) => {
    setError(null); setSuccess(null); setResendingId(s.supplier_id);
    try {
      await suppliersApi.resendConfirmation(pid, s.supplier_id);
      setSuccess(`Confirmation re-sent to ${s.contact_email}.`);
      void load();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to resend confirmation.'));
    } finally {
      setResendingId(null);
    }
  };

  const alert: React.CSSProperties = { padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 14 };

  return (
    <div>
      {error && <div style={{ ...alert, background: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5' }}>{error}</div>}
      {success && <div style={{ ...alert, background: '#DCFCE7', color: '#166534', border: '1px solid #86EFAC' }}>{success}</div>}

      {canManage && showForm && (
        <Card className="qms-form-section">
          <h3 className="qms-section-heading-plain" style={{ marginBottom: 12 }}>Register an RMC supplier</h3>
          <form onSubmit={handleSubmit} className="qms-grid-2">
            <Input label="Supplier company name" required value={form.supplier_name} onChange={set('supplier_name')} placeholder="e.g. UltraTech RMC" />
            <Input label="Plant name" value={form.plant_name} onChange={set('plant_name')} />
            <Input label="GST number" value={form.gst_number} onChange={set('gst_number')} />
            <Input label="Plant location" value={form.plant_location} onChange={set('plant_location')} />
            <Input label="Distance from site (km)" type="number" value={form.plant_distance_km} onChange={set('plant_distance_km')} />
            <Input label="Contact email" type="email" value={form.contact_email} onChange={set('contact_email')} />
            <Input label="Contact phone" type="tel" value={form.contact_phone} onChange={set('contact_phone')} />
            <div style={{ gridColumn: 'span 2', display: 'flex', gap: 8 }}>
              <Button type="submit" variant="primary" disabled={submitting} icon={<Plus size={16} />}>
                {submitting ? 'Registering…' : 'Register supplier'}
              </Button>
              <Button type="button" variant="ghost" disabled={submitting} onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="qms-form-section" padding="none">
        <div className="qms-p-4 qms-border-b" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <h3 className="qms-section-heading-plain">Suppliers</h3>
          {canManage && !showForm && (
            <Button variant="primary" size="sm" icon={<Plus size={15} />} onClick={() => setShowForm(true)}>
              Register supplier
            </Button>
          )}
        </div>
        <div className="qms-table-container">
          <table className="qms-table">
            <thead><tr><th>Supplier</th><th>Hired by</th><th>Plant</th><th>Distance</th><th>Contact</th><th>Confirmation</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-muted">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="text-muted">No suppliers yet.</td></tr>
              ) : (
                rows.map((s) => (
                  <tr
                    key={s.supplier_id}
                    onClick={() => navigate(`/app/projects/${pid}/suppliers/${s.supplier_id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td className="font-medium">{s.supplier_name}</td>
                    <td>{s.contractor_org_name ?? '—'}</td>
                    <td>{s.plant_name ?? s.plant_location ?? '—'}</td>
                    <td>{s.plant_distance_km != null ? `${s.plant_distance_km} km` : '—'}</td>
                    <td>{s.contact_email ?? s.contact_phone ?? '—'}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <Badge variant={CONF_VARIANT[s.status]}>{CONF_LABEL[s.status]}</Badge>
                        {s.status === 'CONFIRMED' && s.confirmed_at && (
                          <span className="qms-text-sm text-muted">{new Date(s.confirmed_at).toLocaleDateString()}</span>
                        )}
                        {canManage && s.status !== 'CONFIRMED' && s.contact_email && (
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Mail size={13} />}
                            disabled={resendingId === s.supplier_id}
                            onClick={(e) => { e.stopPropagation(); void handleResend(s); }}
                          >
                            {resendingId === s.supplier_id ? 'Sending…' : 'Resend'}
                          </Button>
                        )}
                      </div>
                    </td>
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
