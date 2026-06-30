import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { ErrorBox } from '../../components/ui/ErrorBox';
import { Plus, Mail, FileDown } from 'lucide-react';
import { useProject } from '../../components/layout/ProjectLayout';
import { getApiErrorMessage } from '../../api/client';
import { toast } from '../../lib/toast';
import { useCreateSupplier, useResendSupplierConfirmation, useSuppliers } from '../../queries/suppliers';
import { useDocuments, useDownloadDocument } from '../../queries/documents';
import { num, str } from '../../lib/coerce';
import type { ConfirmationStatus, DocumentResponse, SupplierCreate, SupplierResponse } from '../../types/master';

const CONF_VARIANT: Record<ConfirmationStatus, 'pass' | 'warn' | 'fail'> = {
  CONFIRMED: 'pass', PENDING: 'warn', DECLINED: 'fail',
};
const CONF_LABEL: Record<ConfirmationStatus, string> = {
  CONFIRMED: 'Confirmed', PENDING: 'Pending', DECLINED: 'Declined',
};

const EMPTY = { supplier_name: '', plant_name: '', gst_number: '', plant_location: '', plant_distance_km: '', contact_email: '', contact_phone: '', mix_design_document_id: '' };

export const ProjectSuppliers: React.FC = () => {
  const { project } = useProject();
  const navigate = useNavigate();
  const pid = project.project_id;
  const canManage = project.access.can_manage_contractor_side;

  const { data: rows = [], isPending, error: loadError } = useSuppliers(pid);
  const { data: documents = [] } = useDocuments(pid);
  const createSupplier = useCreateSupplier(pid);
  const resend = useResendSupplierConfirmation(pid);
  const download = useDownloadDocument(pid);

  const docById = useMemo(
    () => new Map<number, DocumentResponse>(documents.map((d) => [d.document_id, d])),
    [documents],
  );

  const [form, setForm] = useState({ ...EMPTY });
  const [showForm, setShowForm] = useState(false);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: SupplierCreate = {
      supplier_name: form.supplier_name.trim(),
      plant_name: str(form.plant_name),
      gst_number: str(form.gst_number),
      plant_location: str(form.plant_location),
      plant_distance_km: num(form.plant_distance_km),
      contact_email: str(form.contact_email),
      contact_phone: str(form.contact_phone),
      mix_design_document_id: form.mix_design_document_id ? Number(form.mix_design_document_id) : null,
    };
    try {
      const s = await createSupplier.mutateAsync(payload);
      toast.success(
        s.contact_email
          ? `Supplier "${s.supplier_name}" registered — confirmation sent to ${s.contact_email}.`
          : `Supplier "${s.supplier_name}" registered. Add a contact email to send a confirmation request.`,
      );
      setForm({ ...EMPTY });
      setShowForm(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Unable to register supplier.'));
    }
  };

  const handleResend = async (s: SupplierResponse) => {
    try {
      await resend.mutateAsync(s.supplier_id);
      toast.success(`Confirmation re-sent to ${s.contact_email}.`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Unable to resend confirmation.'));
    }
  };

  return (
    <div>
      {loadError && <ErrorBox>{getApiErrorMessage(loadError, 'Unable to load suppliers.')}</ErrorBox>}

      {canManage && showForm && (
        <Card className="qms-form-section">
          <h3 className="qms-section-heading-plain qms-mb-12">Register an RMC supplier</h3>
          <form onSubmit={handleSubmit} className="qms-grid-2">
            <Input label="Supplier company name" required value={form.supplier_name} onChange={set('supplier_name')} placeholder="e.g. UltraTech RMC" />
            <Input label="Plant name" value={form.plant_name} onChange={set('plant_name')} />
            <Input label="GST number" value={form.gst_number} onChange={set('gst_number')} />
            <Input label="Plant location" value={form.plant_location} onChange={set('plant_location')} />
            <Input label="Distance from site (km)" type="number" value={form.plant_distance_km} onChange={set('plant_distance_km')} />
            <Input label="Contact email" type="email" required value={form.contact_email} onChange={set('contact_email')} placeholder="RMC plant gets its links here" />
            <Input label="Contact phone" type="tel" value={form.contact_phone} onChange={set('contact_phone')} />
            <Select
              label="Mix design document"
              value={form.mix_design_document_id}
              onChange={(e) => setForm((p) => ({ ...p, mix_design_document_id: e.target.value }))}
              options={[
                { label: documents.length ? 'None — attach later' : 'No documents — upload one in Documents', value: '' },
                ...documents.map((d) => ({ label: d.title ?? d.original_filename, value: d.document_id })),
              ]}
            />
            <div className="qms-form-actions qms-grid-span-2">
              <Button type="submit" variant="primary" disabled={createSupplier.isPending || !form.supplier_name.trim() || !form.contact_email.trim()} icon={<Plus size={16} />}>
                {createSupplier.isPending ? 'Registering…' : 'Register supplier'}
              </Button>
              <Button type="button" variant="ghost" disabled={createSupplier.isPending} onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="qms-form-section" padding="none">
        <div className="qms-card-header">
          <h3 className="qms-section-heading-plain">Suppliers</h3>
          {canManage && !showForm && (
            <Button variant="primary" size="sm" icon={<Plus size={15} />} onClick={() => setShowForm(true)}>
              Register supplier
            </Button>
          )}
        </div>
        <div className="qms-table-container">
          <table className="qms-table">
            <thead><tr><th>Supplier</th><th>Hired by</th><th>Plant</th><th>Distance</th><th>Mix design</th><th>Contact</th><th>Confirmation</th></tr></thead>
            <tbody>
              {isPending ? (
                <tr><td colSpan={7} className="text-muted">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="text-muted">No suppliers yet.</td></tr>
              ) : (
                rows.map((s) => (
                  <tr key={s.supplier_id}>
                    <td className="font-medium">
                      <button
                        type="button"
                        className="qms-linklike font-medium"
                        onClick={() => navigate(`/app/projects/${pid}/suppliers/${s.supplier_id}`)}
                      >
                        {s.supplier_name}
                      </button>
                    </td>
                    <td>{s.contractor_org_name ?? '—'}</td>
                    <td>{s.plant_name ?? s.plant_location ?? '—'}</td>
                    <td>{s.plant_distance_km != null ? `${s.plant_distance_km} km` : '—'}</td>
                    <td>
                      {s.mix_design_document_id && docById.has(s.mix_design_document_id) ? (
                        <button
                          type="button"
                          className="qms-linklike"
                          onClick={() => download.mutate(docById.get(s.mix_design_document_id as number) as DocumentResponse)}
                        >
                          <FileDown size={13} /> {s.mix_design_document_name ?? 'PDF'}
                        </button>
                      ) : s.mix_design_document_name ? (
                        <span className="qms-text-sm">{s.mix_design_document_name}</span>
                      ) : '—'}
                    </td>
                    <td>{s.contact_email ?? s.contact_phone ?? '—'}</td>
                    <td>
                      <div className="qms-cell-actions">
                        <Badge variant={CONF_VARIANT[s.status]}>{CONF_LABEL[s.status]}</Badge>
                        {s.status === 'CONFIRMED' && s.confirmed_at && (
                          <span className="qms-text-sm text-muted">{new Date(s.confirmed_at).toLocaleDateString()}</span>
                        )}
                        {canManage && s.status !== 'CONFIRMED' && s.contact_email && (
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Mail size={13} />}
                            disabled={resend.isPending && resend.variables === s.supplier_id}
                            onClick={() => handleResend(s)}
                          >
                            {resend.isPending && resend.variables === s.supplier_id ? 'Sending…' : 'Resend'}
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
