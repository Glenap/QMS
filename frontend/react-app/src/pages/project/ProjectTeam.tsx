import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { ErrorBox } from '../../components/ui/ErrorBox';
import { UserPlus, UserMinus, UserCheck } from 'lucide-react';
import { useProject } from '../../components/layout/ProjectLayout';
import { useAuth } from '../../hooks/useAuth';
import { getApiErrorMessage } from '../../api/client';
import { toast } from '../../lib/toast';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { projectRoleLabel } from '../../lib/roles';
import { useAssignMember, useOrgTeam, useProjectMembers, useSetMemberActive } from '../../queries/team';
import type { ProjectMember, ProjectMemberStatus, ProjectRoleValue } from '../../types/master';

const STATUS_BADGE: Record<ProjectMemberStatus, { variant: 'pass' | 'warn' | 'pending' | 'default'; label: string }> = {
  ACTIVE: { variant: 'pass', label: 'Active' },
  UNVERIFIED: { variant: 'warn', label: 'Unverified' },
  INVITED: { variant: 'pending', label: 'Invited' },
  DEACTIVATED: { variant: 'default', label: 'Deactivated' },
};

const CONTRACTOR_SIDE_ROLES = ['CONTRACTOR_LEAD', 'PROJECT_MANAGER', 'QUALITY_ENGINEER', 'SUPERVISOR'];

export const ProjectTeam: React.FC = () => {
  const { project } = useProject();
  const { user } = useAuth();
  const pid = project.project_id;

  // Which project designations can the viewer assign (mirrors the backend rules).
  const assignable: ProjectRoleValue[] = useMemo(() => {
    if (project.access.side === 'CLIENT') {
      return user?.role === 'CLIENT_ADMIN' ? ['CLIENT_LEAD'] : [];
    }
    if (project.access.is_contractor_admin) {
      return ['CONTRACTOR_LEAD', 'PROJECT_MANAGER', 'QUALITY_ENGINEER', 'SUPERVISOR'];
    }
    if (project.access.can_manage_contractor_side) {
      return ['PROJECT_MANAGER', 'QUALITY_ENGINEER', 'SUPERVISOR'];
    }
    return [];
  }, [project.access, user]);

  const { data: members = [], isPending, error: loadError } = useProjectMembers(pid);
  const { data: roster = [] } = useOrgTeam();
  const assign = useAssignMember(pid);
  const setActive = useSetMemberActive(pid);
  const confirm = useConfirm();

  // Existing team members free to assign: active, not an org admin, not already
  // on a project (one active project at a time), not already on this one.
  const available = useMemo(() => {
    const taken = new Set(members.map((m) => m.email));
    return roster.filter(
      (r) => r.status === 'ACTIVE' && !r.is_org_admin
        && r.active_project_id == null && !taken.has(r.email),
    );
  }, [roster, members]);

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<ProjectRoleValue | ''>(assignable[0] ?? '');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { if (!role && assignable.length) setRole(assignable[0]); }, [assignable, role]);

  const isOrgAdmin = user?.role === 'CLIENT_ADMIN' || project.access.is_contractor_admin;
  const canManageMember = (m: ProjectMember): boolean => {
    if (m.user_id == null || m.user_id === user?.user_id) return false;
    if (user?.role === 'CLIENT_ADMIN') return m.project_role === 'CLIENT_LEAD';
    if (project.access.is_contractor_admin) return CONTRACTOR_SIDE_ROLES.includes(m.project_role);
    return false;
  };

  const toggleMember = async (m: ProjectMember) => {
    if (m.user_id == null) return;
    const deactivate = m.status !== 'DEACTIVATED';
    if (deactivate && !(await confirm({
      title: 'Deactivate member?',
      description: `${m.full_name ?? m.email} will immediately lose access until reactivated.`,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!role || !email) return;
    try {
      await assign.mutateAsync({ email, project_role: role });
      toast.success(`${email} assigned as ${projectRoleLabel(role)}. They've been notified.`);
      setEmail('');
      setShowForm(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Unable to assign member.'));
    }
  };

  return (
    <div>
      {loadError && <ErrorBox>{getApiErrorMessage(loadError, 'Unable to load team.')}</ErrorBox>}

      {assignable.length > 0 && showForm && (
        <Card className="qms-form-section">
          <h3 className="qms-section-heading-plain qms-mb-12">Assign a team member</h3>
          <form onSubmit={handleSubmit} className="qms-grid-2">
            <Select
              label="Team member"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              options={[
                { label: available.length ? 'Select a member…' : 'No available members', value: '' },
                ...available.map((m) => ({
                  label: `${m.full_name ?? m.email} · ${m.email}`,
                  value: m.email,
                })),
              ]}
            />
            <Select label="Designation" required value={role} onChange={(e) => setRole(e.target.value as ProjectRoleValue)}
              options={assignable.map((r) => ({ label: projectRoleLabel(r), value: r }))} />
            <div className="qms-form-actions qms-grid-span-2">
              <Button type="submit" variant="primary" disabled={assign.isPending || !email} icon={<UserPlus size={16} />}>
                {assign.isPending ? 'Assigning…' : 'Assign to project'}
              </Button>
              <Button type="button" variant="ghost" disabled={assign.isPending} onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <span className="qms-text-sm text-muted">
                Only existing team members can be assigned. Add new people on the{' '}
                <Link to="/app/team">Team</Link> page first — a member on another active project appears once it's completed.
              </span>
            </div>
          </form>
        </Card>
      )}

      <Card className="qms-form-section" padding="none">
        <div className="qms-card-header">
          <h3 className="qms-section-heading-plain">Team members</h3>
          {assignable.length > 0 && !showForm && (
            <Button variant="primary" size="sm" icon={<UserPlus size={15} />} onClick={() => setShowForm(true)}>
              Assign member
            </Button>
          )}
        </div>
        <div className="qms-table-container">
          <table className="qms-table">
            <thead>
              <tr><th>Name</th><th>Email</th><th>Designation</th><th>Status</th>{isOrgAdmin && <th></th>}</tr>
            </thead>
            <tbody>
              {isPending ? (
                <tr><td colSpan={isOrgAdmin ? 5 : 4} className="text-muted">Loading…</td></tr>
              ) : members.length === 0 ? (
                <tr><td colSpan={isOrgAdmin ? 5 : 4} className="text-muted">No team members assigned yet.</td></tr>
              ) : (
                members.map((m) => {
                  const toggling = setActive.isPending && setActive.variables?.userId === m.user_id;
                  return (
                    <tr key={m.email}>
                      <td className="font-medium">{m.full_name ?? '—'}</td>
                      <td>{m.email}</td>
                      <td>{projectRoleLabel(m.project_role)}</td>
                      <td><Badge variant={STATUS_BADGE[m.status].variant}>{STATUS_BADGE[m.status].label}</Badge></td>
                      {isOrgAdmin && (
                        <td>
                          {canManageMember(m) && (
                            m.status === 'DEACTIVATED' ? (
                              <Button variant="ghost" size="sm" icon={<UserCheck size={14} />} disabled={toggling} onClick={() => toggleMember(m)}>
                                {toggling ? 'Saving…' : 'Reactivate'}
                              </Button>
                            ) : (
                              <Button variant="ghost" size="sm" icon={<UserMinus size={14} />} disabled={toggling} onClick={() => toggleMember(m)}>
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
