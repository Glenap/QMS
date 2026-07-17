import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { ErrorBox } from '../../components/ui/ErrorBox';
import { Plus, Mail } from 'lucide-react';
import { useProject } from '../../components/layout/ProjectLayout';
import { BlockControl } from '../../components/BlockControl';
import { getApiErrorMessage } from '../../api/client';
import { toast } from '../../lib/toast';
import { canBlockEntities } from '../../lib/roles';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { useCreateLab, useLabs, useResendLabConfirmation, useReviewLab, useSetLabBlocked } from '../../queries/labs';
import { str } from '../../lib/coerce';
import type { ConfirmationStatus, LabCreate, LabResponse } from '../../types/master';

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
  lab_name: z.string().min(1, 'Lab name is required'),
  lab_type: z.enum(['THIRD_PARTY', 'IN_HOUSE']),
  accreditation_no: z.string(),
  city: z.string(),
  state: z.string(),
  contact_email: z.string().min(1, 'Contact email is required').email('Enter a valid email'),
  contact_phone: z.string(),
});
type FormValues = z.infer<typeof schema>;
const EMPTY: FormValues = { lab_name: '', lab_type: 'THIRD_PARTY', accreditation_no: '', city: '', state: '', contact_email: '', contact_phone: '' };

export const ProjectLabs: React.FC = () => {
  const { project } = useProject();
  const pid = project.project_id;
  const clientMode = project.registration_by === 'CLIENT';
  const canRegister = clientMode
    ? project.access.can_manage_client_side
    : project.access.can_manage_contractor_side;
  const canReview = project.access.can_manage_contractor_side;
  const canBlock = canBlockEntities(project.access);

  const { data: rows = [], isPending, error: loadError } = useLabs(pid);
  const createLab = useCreateLab(pid);
  const resend = useResendLabConfirmation(pid);
  const setBlocked = useSetLabBlocked(pid);
  const review = useReviewLab(pid);
  const confirm = useConfirm();

  const reviewLab = async (l: LabResponse, accept: boolean) => {
    if (!accept && !(await confirm({
      title: `Reject ${l.lab_name}?`,
      description: 'This lab won’t be usable for cube dispatch on this project.',
      confirmLabel: 'Reject', danger: true,
    }))) {
      return;
    }
    try {
      await review.mutateAsync({ labId: l.lab_id, accept });
      toast.success(accept ? `Approved ${l.lab_name}.` : `Rejected ${l.lab_name}.`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not update the approval.'));
    }
  };

  const toggleBlock = async (l: LabResponse, reason?: string) => {
    try {
      await setBlocked.mutateAsync({ labId: l.lab_id, block: !l.is_blocked, reason });
      toast.success(l.is_blocked ? `Unblocked ${l.lab_name}.` : `Blocked ${l.lab_name}.`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not update the lab.'));
    }
  };

  const [showForm, setShowForm] = useState(false);
  const [tab, setTab] = useState<'THIRD_PARTY' | 'IN_HOUSE'>('THIRD_PARTY');
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
  });

  const onSubmit = async (form: FormValues) => {
    const payload: LabCreate = {
      lab_name: form.lab_name.trim(),
      lab_type: form.lab_type,
      accreditation_no: str(form.accreditation_no),
      city: str(form.city),
      state: str(form.state),
      contact_email: str(form.contact_email),
      contact_phone: str(form.contact_phone),
    };
    try {
      const l = await createLab.mutateAsync(payload);
      toast.success(`Lab "${l.lab_name}" registered — confirmation sent to ${l.contact_email}.`);
      reset();
      setShowForm(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Unable to register lab.'));
    }
  };

  const handleResend = async (l: LabResponse) => {
    try {
      await resend.mutateAsync(l.lab_id);
      toast.success(`Confirmation re-sent to ${l.contact_email}.`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Unable to resend confirmation.'));
    }
  };

  const labRow = (l: LabResponse) => (
    <tr key={l.lab_id}>
      <td className="font-medium">{l.lab_name}</td>
      <td>{l.contractor_org_name ?? '—'}</td>
      <td>{[l.city, l.state].filter(Boolean).join(', ') || '—'}</td>
      <td>{l.contact_email ?? l.contact_phone ?? '—'}</td>
      <td>
        <div className="qms-cell-actions">
          {l.registered_by === 'CLIENT' && l.approval_status !== 'NOT_REQUIRED' && (
            <Badge variant={APPROVAL[l.approval_status].variant} title={l.approval_reason ?? undefined}>
              {APPROVAL[l.approval_status].label}
            </Badge>
          )}
          {canReview && l.approval_status === 'PENDING' && (
            <>
              <Button variant="ghost" size="sm" disabled={review.isPending} onClick={() => reviewLab(l, true)}>
                Approve
              </Button>
              <Button variant="ghost" size="sm" disabled={review.isPending} onClick={() => reviewLab(l, false)}>
                Reject
              </Button>
            </>
          )}
          {l.is_blocked ? (
            <Badge variant="fail" title={l.block_reason ?? undefined}>Blocked</Badge>
          ) : (
            <Badge variant={CONF_VARIANT[l.status]}>{CONF_LABEL[l.status]}</Badge>
          )}
          {!l.is_blocked && l.status === 'CONFIRMED' && l.confirmed_at && (
            <span className="qms-text-sm text-muted">{new Date(l.confirmed_at).toLocaleDateString()}</span>
          )}
          {canRegister && !l.is_blocked && l.status !== 'CONFIRMED' && l.contact_email && (
            <Button
              variant="ghost"
              size="sm"
              icon={<Mail size={13} />}
              disabled={resend.isPending && resend.variables === l.lab_id}
              onClick={() => handleResend(l)}
            >
              {resend.isPending && resend.variables === l.lab_id ? 'Sending…' : 'Resend'}
            </Button>
          )}
          {canBlock && (
            <BlockControl
              blocked={l.is_blocked}
              busy={setBlocked.isPending}
              onBlock={(reason) => toggleBlock(l, reason)}
              onUnblock={() => toggleBlock(l)}
            />
          )}
        </div>
      </td>
    </tr>
  );

  const thirdParty = rows.filter((l) => l.lab_type === 'THIRD_PARTY');
  const inHouse = rows.filter((l) => l.lab_type === 'IN_HOUSE');
  const active = tab === 'THIRD_PARTY' ? thirdParty : inHouse;

  // Horizontal tab switcher (better than stacked sections when there are many
  // labs) — Third-party / In-house.
  const tabBtn = (key: 'THIRD_PARTY' | 'IN_HOUSE', label: string, count: number) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === key}
      onClick={() => setTab(key)}
      style={{
        padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer',
        borderBottom: tab === key ? '2px solid var(--blue)' : '2px solid transparent',
        color: tab === key ? 'var(--blue)' : 'var(--gray-600)',
        fontWeight: 600, fontSize: 14, marginBottom: -1,
      }}
    >
      {label}
      <span
        style={{
          marginLeft: 6, padding: '1px 7px', borderRadius: 99, fontSize: 12,
          background: tab === key ? 'var(--blue-light)' : 'var(--gray-100)',
          color: tab === key ? 'var(--blue)' : 'var(--gray-500)',
        }}
      >
        {count}
      </span>
    </button>
  );

  return (
    <div>
      {loadError && <ErrorBox>{getApiErrorMessage(loadError, 'Unable to load labs.')}</ErrorBox>}

      {canRegister && showForm && (
        <Card className="qms-form-section">
          <h3 className="qms-section-heading-plain qms-mb-12">Register a testing lab</h3>
          <form onSubmit={handleSubmit(onSubmit)} className="qms-grid-2" noValidate>
            <Input label="Lab name" required error={errors.lab_name?.message} placeholder="e.g. SGS Labs" {...register('lab_name')} />
            <Select label="Lab type" {...register('lab_type')} options={[
              { label: 'Third party', value: 'THIRD_PARTY' },
              { label: 'In-house', value: 'IN_HOUSE' },
            ]} />
            <Input label="Accreditation no." {...register('accreditation_no')} />
            <Input label="City" {...register('city')} />
            <Input label="State" {...register('state')} />
            <Input label="Contact email" type="email" required error={errors.contact_email?.message} placeholder="Lab gets its report links here" {...register('contact_email')} />
            <Input label="Contact phone" type="tel" {...register('contact_phone')} />
            <div className="qms-form-actions qms-grid-span-2">
              <Button type="submit" variant="primary" disabled={createLab.isPending} icon={<Plus size={16} />}>
                {createLab.isPending ? 'Registering…' : 'Register lab'}
              </Button>
              <Button type="button" variant="ghost" disabled={createLab.isPending} onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="qms-form-section" padding="none">
        <div className="qms-card-header">
          <div role="tablist" style={{ display: 'flex', gap: 4 }}>
            {tabBtn('THIRD_PARTY', 'Third-party', thirdParty.length)}
            {tabBtn('IN_HOUSE', 'In-house', inHouse.length)}
          </div>
          {canRegister && !showForm && (
            <Button variant="primary" size="sm" icon={<Plus size={15} />} onClick={() => setShowForm(true)}>
              Register lab
            </Button>
          )}
        </div>
        <p className="qms-text-sm text-muted" style={{ margin: '0 16px 4px' }}>
          {tab === 'THIRD_PARTY'
            ? 'External / independent testing laboratories.'
            : 'The contractor’s own on-site testing laboratories.'}
        </p>
        <div className="qms-table-container">
          <table className="qms-table">
            <thead><tr><th>Lab</th><th>Hired by</th><th>Location</th><th>Contact</th><th>Confirmation</th></tr></thead>
            <tbody>
              {isPending ? (
                <tr><td colSpan={5} className="text-muted">Loading…</td></tr>
              ) : active.length === 0 ? (
                <tr><td colSpan={5} className="text-muted">No {tab === 'THIRD_PARTY' ? 'third-party' : 'in-house'} labs yet.</td></tr>
              ) : (
                active.map(labRow)
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
