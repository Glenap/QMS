import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { ErrorBox } from '../../components/ui/ErrorBox';
import { Plus, Mail } from 'lucide-react';
import { useProject } from '../../components/layout/ProjectLayout';
import { getApiErrorMessage } from '../../api/client';
import { toast } from '../../lib/toast';
import { useCreateLab, useLabs, useResendLabConfirmation } from '../../queries/labs';
import type { ConfirmationStatus, LabCreate, LabResponse, LabType } from '../../types/master';

const str = (v: string): string | undefined => (v.trim() === '' ? undefined : v.trim());

const CONF_VARIANT: Record<ConfirmationStatus, 'pass' | 'warn' | 'fail'> = {
  CONFIRMED: 'pass', PENDING: 'warn', DECLINED: 'fail',
};
const CONF_LABEL: Record<ConfirmationStatus, string> = {
  CONFIRMED: 'Confirmed', PENDING: 'Pending', DECLINED: 'Declined',
};

const EMPTY = { lab_name: '', lab_type: 'THIRD_PARTY' as LabType, accreditation_no: '', city: '', state: '', contact_email: '', contact_phone: '' };

export const ProjectLabs: React.FC = () => {
  const { project } = useProject();
  const pid = project.project_id;
  const canManage = project.access.can_manage_contractor_side;

  const { data: rows = [], isPending, error: loadError } = useLabs(pid);
  const createLab = useCreateLab(pid);
  const resend = useResendLabConfirmation(pid);

  const [form, setForm] = useState({ ...EMPTY });
  const [showForm, setShowForm] = useState(false);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      toast.success(
        l.contact_email
          ? `Lab "${l.lab_name}" registered — confirmation sent to ${l.contact_email}.`
          : `Lab "${l.lab_name}" registered. Add a contact email to send a confirmation request.`,
      );
      setForm({ ...EMPTY });
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

  return (
    <div>
      {loadError && <ErrorBox>{getApiErrorMessage(loadError, 'Unable to load labs.')}</ErrorBox>}

      {canManage && showForm && (
        <Card className="qms-form-section">
          <h3 className="qms-section-heading-plain qms-mb-12">Register a testing lab</h3>
          <form onSubmit={handleSubmit} className="qms-grid-2">
            <Input label="Lab name" required value={form.lab_name} onChange={set('lab_name')} placeholder="e.g. SGS Labs" />
            <Select label="Lab type" value={form.lab_type} onChange={set('lab_type')} options={[
              { label: 'Third party', value: 'THIRD_PARTY' },
              { label: 'In-house', value: 'IN_HOUSE' },
            ]} />
            <Input label="Accreditation no." value={form.accreditation_no} onChange={set('accreditation_no')} />
            <Input label="City" value={form.city} onChange={set('city')} />
            <Input label="State" value={form.state} onChange={set('state')} />
            <Input label="Contact email" type="email" value={form.contact_email} onChange={set('contact_email')} />
            <Input label="Contact phone" type="tel" value={form.contact_phone} onChange={set('contact_phone')} />
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
          <h3 className="qms-section-heading-plain">Testing labs</h3>
          {canManage && !showForm && (
            <Button variant="primary" size="sm" icon={<Plus size={15} />} onClick={() => setShowForm(true)}>
              Register lab
            </Button>
          )}
        </div>
        <div className="qms-table-container">
          <table className="qms-table">
            <thead><tr><th>Lab</th><th>Hired by</th><th>Type</th><th>Location</th><th>Contact</th><th>Confirmation</th></tr></thead>
            <tbody>
              {isPending ? (
                <tr><td colSpan={6} className="text-muted">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="text-muted">No labs yet.</td></tr>
              ) : (
                rows.map((l) => (
                  <tr key={l.lab_id}>
                    <td className="font-medium">{l.lab_name}</td>
                    <td>{l.contractor_org_name ?? '—'}</td>
                    <td>{l.lab_type === 'THIRD_PARTY' ? 'Third party' : 'In-house'}</td>
                    <td>{[l.city, l.state].filter(Boolean).join(', ') || '—'}</td>
                    <td>{l.contact_email ?? l.contact_phone ?? '—'}</td>
                    <td>
                      <div className="qms-cell-actions">
                        <Badge variant={CONF_VARIANT[l.status]}>{CONF_LABEL[l.status]}</Badge>
                        {l.status === 'CONFIRMED' && l.confirmed_at && (
                          <span className="qms-text-sm text-muted">{new Date(l.confirmed_at).toLocaleDateString()}</span>
                        )}
                        {canManage && l.status !== 'CONFIRMED' && l.contact_email && (
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
