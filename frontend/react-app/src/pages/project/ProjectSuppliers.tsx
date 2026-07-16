import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { ErrorBox } from '../../components/ui/ErrorBox';
import { Plus, Mail, FileDown } from 'lucide-react';
import { useProject } from '../../components/layout/ProjectLayout';
import { BlockControl } from '../../components/BlockControl';
import { getApiErrorMessage } from '../../api/client';
import { toast } from '../../lib/toast';
import { canBlockEntities } from '../../lib/roles';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import {
  useCreateSupplier,
  useResendSupplierConfirmation,
  useReviewSupplier,
  useSetSupplierBlocked,
  useSuppliers,
} from '../../queries/suppliers';
import { useDocuments, useDownloadDocument } from '../../queries/documents';
import { num, str } from '../../lib/coerce';
import type { ConfirmationStatus, DocumentResponse, SupplierCreate, SupplierResponse } from '../../types/master';

const CONF_VARIANT: Record<ConfirmationStatus, 'pass' | 'warn' | 'fail'> = {
  CONFIRMED: 'pass', PENDING: 'warn', DECLINED: 'fail',
};
const CONF_LABEL: Record<ConfirmationStatus, string> = {
  CONFIRMED: 'Confirmed', PENDING: 'Pending', DECLINED: 'Declined',
};
const APPROVAL: Record<string, { variant: 'pass' | 'warn' | 'fail'; label: string }> = {
  PENDING: { variant: 'warn', label: 'Awaiting approval' },
  ACCEPTED: { variant: 'pass', label: 'Approved' },
  REJECTED: { variant: 'fail', label: 'Rejected' },
};

const schema = z.object({
  supplier_name: z.string().min(1, 'Supplier name is required'),
  plant_name: z.string(),
  gst_number: z.string(),
  plant_location: z.string(),
  plant_distance_km: z.string(),
  contact_email: z.string().min(1, 'Contact email is required').email('Enter a valid email'),
  contact_phone: z.string(),
  mix_design_document_id: z.string(),
});
type FormValues = z.infer<typeof schema>;
const EMPTY: FormValues = { supplier_name: '', plant_name: '', gst_number: '', plant_location: '', plant_distance_km: '', contact_email: '', contact_phone: '', mix_design_document_id: '' };

export const ProjectSuppliers: React.FC = () => {
  const { project } = useProject();
  const navigate = useNavigate();
  const pid = project.project_id;
  // Who registers RMC depends on the project mode; the contractor accepts/rejects
  // client-registered ones.
  const clientMode = project.registration_by === 'CLIENT';
  const canRegister = clientMode
    ? project.access.can_manage_client_side
    : project.access.can_manage_contractor_side;
  const canReview = project.access.can_manage_contractor_side;
  const canBlock = canBlockEntities(project.access);

  const { data: rows = [], isPending, error: loadError } = useSuppliers(pid);
  const { data: documents = [] } = useDocuments(pid);
  const createSupplier = useCreateSupplier(pid);
  const setBlocked = useSetSupplierBlocked(pid);
  const review = useReviewSupplier(pid);
  const confirm = useConfirm();

  const reviewSupplier = async (s: SupplierResponse, accept: boolean) => {
    if (!accept && !(await confirm({
      title: `Reject ${s.supplier_name}?`,
      description: 'This RMC won’t be usable for dispatch on this project.',
      confirmLabel: 'Reject', danger: true,
    }))) {
      return;
    }
    try {
      await review.mutateAsync({ supplierId: s.supplier_id, accept });
      toast.success(accept ? `Approved ${s.supplier_name}.` : `Rejected ${s.supplier_name}.`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not update the approval.'));
    }
  };

  const toggleBlock = async (s: SupplierResponse, reason?: string) => {
    try {
      await setBlocked.mutateAsync({ supplierId: s.supplier_id, block: !s.is_blocked, reason });
      toast.success(s.is_blocked ? `Unblocked ${s.supplier_name}.` : `Blocked ${s.supplier_name}.`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not update the supplier.'));
    }
  };
  const resend = useResendSupplierConfirmation(pid);
  const download = useDownloadDocument(pid);

  const docById = useMemo(
    () => new Map<number, DocumentResponse>(documents.map((d) => [d.document_id, d])),
    [documents],
  );

  const [showForm, setShowForm] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
  });

  const onSubmit = async (form: FormValues) => {
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
      toast.success(`Supplier "${s.supplier_name}" registered — confirmation sent to ${s.contact_email}.`);
      reset();
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

      {canRegister && showForm && (
        <Card className="qms-form-section">
          <h3 className="qms-section-heading-plain qms-mb-12">Register an RMC supplier</h3>
          <form onSubmit={handleSubmit(onSubmit)} className="qms-grid-2" noValidate>
            <Input label="Supplier company name" required error={errors.supplier_name?.message} placeholder="e.g. UltraTech RMC" {...register('supplier_name')} />
            <Input label="Plant name" {...register('plant_name')} />
            <Input label="GST number" {...register('gst_number')} />
            <Input label="Plant location" {...register('plant_location')} />
            <Input label="Distance from site (km)" type="number" {...register('plant_distance_km')} />
            <Input label="Contact email" type="email" required error={errors.contact_email?.message} placeholder="RMC plant gets its links here" {...register('contact_email')} />
            <Input label="Contact phone" type="tel" {...register('contact_phone')} />
            <Select
              label="Mix design document"
              {...register('mix_design_document_id')}
              options={[
                { label: documents.length ? 'None — attach later' : 'No documents — upload one in Documents', value: '' },
                ...documents.map((d) => ({ label: d.title ?? d.original_filename, value: d.document_id })),
              ]}
            />
            <div className="qms-form-actions qms-grid-span-2">
              <Button type="submit" variant="primary" disabled={createSupplier.isPending} icon={<Plus size={16} />}>
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
          {canRegister && !showForm && (
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
                        {s.registered_by === 'CLIENT' && s.approval_status !== 'NOT_REQUIRED' && (
                          <Badge variant={APPROVAL[s.approval_status].variant} title={s.approval_reason ?? undefined}>
                            {APPROVAL[s.approval_status].label}
                          </Badge>
                        )}
                        {canReview && s.approval_status === 'PENDING' && (
                          <>
                            <Button variant="ghost" size="sm" disabled={review.isPending} onClick={() => reviewSupplier(s, true)}>
                              Approve
                            </Button>
                            <Button variant="ghost" size="sm" disabled={review.isPending} onClick={() => reviewSupplier(s, false)}>
                              Reject
                            </Button>
                          </>
                        )}
                        {s.is_blocked ? (
                          <Badge variant="fail" title={s.block_reason ?? undefined}>Blocked</Badge>
                        ) : (
                          <Badge variant={CONF_VARIANT[s.status]}>{CONF_LABEL[s.status]}</Badge>
                        )}
                        {!s.is_blocked && s.status === 'CONFIRMED' && s.confirmed_at && (
                          <span className="qms-text-sm text-muted">{new Date(s.confirmed_at).toLocaleDateString()}</span>
                        )}
                        {canRegister && !s.is_blocked && s.status !== 'CONFIRMED' && s.contact_email && (
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
                        {canBlock && (
                          <BlockControl
                            blocked={s.is_blocked}
                            busy={setBlocked.isPending}
                            onBlock={(reason) => toggleBlock(s, reason)}
                            onUnblock={() => toggleBlock(s)}
                          />
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
