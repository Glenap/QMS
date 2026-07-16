// Top-level org Team page — build the org roster independently of any project.
// Org admins invite people (designation-less); everyone sees the roster with each
// member's current project assignment. Designations are assigned per project.

import React, { useState } from 'react';
import { UserPlus, UserMinus, UserCheck } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { ErrorBox } from '../components/ui/ErrorBox';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { useAuth } from '../hooks/useAuth';
import { getApiErrorMessage } from '../api/client';
import { toast } from '../lib/toast';
import { useInviteMember, useOrgTeam, useSetOrgMemberActive } from '../queries/team';
import type { TeamMemberResponse, UserRole } from '../types/auth';

const STATUS_BADGE: Record<string, { variant: 'pass' | 'warn' | 'pending' | 'default'; label: string }> = {
  ACTIVE: { variant: 'pass', label: 'Active' },
  UNVERIFIED: { variant: 'warn', label: 'Unverified' },
  INVITED: { variant: 'pending', label: 'Invited' },
  DEACTIVATED: { variant: 'default', label: 'Deactivated' },
};

const ROLE_LABEL: Record<string, string> = {
  CLIENT_ADMIN: 'Client Admin', CLIENT_USER: 'Client User',
  CONTRACTOR_ADMIN: 'Contractor Admin', CONTRACTOR_USER: 'Contractor User',
  PROJECT_MANAGER: 'Project Manager', QUALITY_ENGINEER: 'Quality Engineer', SUPERVISOR: 'Supervisor',
};

export const Team: React.FC = () => {
  const { user } = useAuth();
  const { data: members = [], isPending, error: loadError } = useOrgTeam();
  const invite = useInviteMember();
  const setActive = useSetOrgMemberActive();
  const confirm = useConfirm();

  // Only org admins build the team; the invited role is fixed by their side.
  const inviteRole: UserRole | null =
    user?.role === 'CLIENT_ADMIN' ? 'CLIENT_USER'
      : user?.role === 'CONTRACTOR_ADMIN' ? 'CONTRACTOR_USER'
        : null;

  const [email, setEmail] = useState('');
  const [showForm, setShowForm] = useState(false);

  const canManage = (m: TeamMemberResponse): boolean =>
    inviteRole != null && m.user_id != null && m.user_id !== user?.user_id && !m.is_org_admin;

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteRole || !email.trim()) return;
    try {
      await invite.mutateAsync({ invited_email: email.trim(), role: inviteRole });
      toast.success(`Invitation sent to ${email.trim()}.`);
      setEmail('');
      setShowForm(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Unable to send invitation.'));
    }
  };

  const toggle = async (m: TeamMemberResponse) => {
    if (m.user_id == null) return;
    const deactivate = m.status !== 'DEACTIVATED';
    if (deactivate && !(await confirm({
      title: 'Deactivate member?',
      description: `${m.full_name ?? m.email} will lose access to everything until reactivated.`,
      confirmLabel: 'Deactivate',
      danger: true,
    }))) {
      return;
    }
    try {
      await setActive.mutateAsync({ userId: m.user_id, active: !deactivate });
      toast.success(`${m.email} ${deactivate ? 'deactivated' : 'reactivated'}.`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Unable to update member.'));
    }
  };

  return (
    <div className="qms-page">
      <div className="qms-page-header-block">
        <div>
          <h2 className="qms-section-heading-plain">Team</h2>
          <p className="qms-page-subtitle">
            Your organisation's people. Add them here, then assign them to a project with a role.
          </p>
        </div>
        {inviteRole && !showForm && (
          <Button variant="primary" icon={<UserPlus size={16} />} onClick={() => setShowForm(true)}>
            Invite member
          </Button>
        )}
      </div>

      {loadError && <ErrorBox>{getApiErrorMessage(loadError, 'Unable to load the team.')}</ErrorBox>}

      {inviteRole && showForm && (
        <Card className="qms-form-section">
          <h3 className="qms-section-heading-plain qms-mb-12">Invite a team member</h3>
          <form onSubmit={handleInvite} className="qms-grid-2">
            <Input label="Email" type="email" required placeholder="person@company.com"
              value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input label="Joins as" value={ROLE_LABEL[inviteRole]} disabled />
            <div className="qms-form-actions qms-grid-span-2">
              <Button type="submit" variant="primary" disabled={invite.isPending} icon={<UserPlus size={16} />}>
                {invite.isPending ? 'Sending…' : 'Send invitation'}
              </Button>
              <Button type="button" variant="ghost" disabled={invite.isPending} onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <span className="qms-text-sm text-muted">
                They join the team with no project designation — assign that later, per project.
              </span>
            </div>
          </form>
        </Card>
      )}

      <Card className="qms-form-section" padding="none">
        <div className="qms-table-container">
          <table className="qms-table">
            <thead>
              <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Assignment</th>{inviteRole && <th></th>}</tr>
            </thead>
            <tbody>
              {isPending ? (
                <tr><td colSpan={inviteRole ? 6 : 5} className="text-muted">Loading…</td></tr>
              ) : members.length === 0 ? (
                <tr><td colSpan={inviteRole ? 6 : 5} className="text-muted">No team members yet.</td></tr>
              ) : (
                members.map((m) => {
                  const badge = STATUS_BADGE[m.status] ?? STATUS_BADGE.INVITED;
                  const toggling = setActive.isPending && setActive.variables?.userId === m.user_id;
                  return (
                    <tr key={m.email}>
                      <td className="font-medium">{m.full_name ?? '—'}{m.is_org_admin && ' · Admin'}</td>
                      <td>{m.email}</td>
                      <td>{ROLE_LABEL[m.role] ?? m.role}</td>
                      <td><Badge variant={badge.variant}>{badge.label}</Badge></td>
                      <td>
                        {m.active_project_id != null
                          ? <span className="qms-text-sm">On {m.active_project_name}</span>
                          : <span className="qms-text-sm text-muted">Free</span>}
                      </td>
                      {inviteRole && (
                        <td>
                          {canManage(m) && (
                            m.status === 'DEACTIVATED' ? (
                              <Button variant="ghost" size="sm" icon={<UserCheck size={14} />} disabled={toggling} onClick={() => toggle(m)}>
                                {toggling ? 'Saving…' : 'Reactivate'}
                              </Button>
                            ) : (
                              <Button variant="ghost" size="sm" icon={<UserMinus size={14} />} disabled={toggling} onClick={() => toggle(m)}>
                                {toggling ? 'Saving…' : 'Deactivate'}
                              </Button>
                            )
                          )}
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
