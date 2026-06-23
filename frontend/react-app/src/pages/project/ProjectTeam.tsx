import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { UserPlus } from 'lucide-react';
import { useProject } from '../../components/layout/ProjectLayout';
import { useAuth } from '../../hooks/useAuth';
import { projectsApi } from '../../api/projects';
import { getApiErrorMessage } from '../../api/client';
import { projectRoleLabel } from '../../lib/roles';
import type { ProjectMember, ProjectMemberStatus, ProjectRoleValue } from '../../types/master';

const STATUS_BADGE: Record<ProjectMemberStatus, { variant: 'pass' | 'warn' | 'pending'; label: string }> = {
  ACTIVE: { variant: 'pass', label: 'Active' },
  UNVERIFIED: { variant: 'warn', label: 'Unverified' },
  INVITED: { variant: 'pending', label: 'Invited' },
};

export const ProjectTeam: React.FC = () => {
  const { project } = useProject();
  const { user } = useAuth();
  const pid = project.project_id;

  // Which project roles can the viewer assign (mirrors the backend rules).
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

  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<ProjectRoleValue | ''>(assignable[0] ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setMembers(await projectsApi.members(pid));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to load team.'));
    } finally {
      setLoading(false);
    }
  }, [pid]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!role && assignable.length) setRole(assignable[0]); }, [assignable, role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!role) return;
    setError(null); setSuccess(null); setSubmitting(true);
    try {
      const m = await projectsApi.assignMember(pid, { email: email.trim(), project_role: role });
      setSuccess(
        m.status === 'INVITED'
          ? `Invitation sent to ${m.email} as ${projectRoleLabel(role)}.`
          : `${m.email} added as ${projectRoleLabel(role)}.`
      );
      setEmail('');
      void load();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to assign member.'));
    } finally {
      setSubmitting(false);
    }
  };

  const alert: React.CSSProperties = { padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 14 };

  return (
    <div>
      {error && <div style={{ ...alert, background: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5' }}>{error}</div>}
      {success && <div style={{ ...alert, background: '#DCFCE7', color: '#166534', border: '1px solid #86EFAC' }}>{success}</div>}

      {assignable.length > 0 && (
        <Card className="qms-form-section">
          <h3 className="qms-section-heading-plain" style={{ marginBottom: 12 }}>Assign a team member</h3>
          <form onSubmit={handleSubmit} className="qms-grid-2">
            <Input label="Email" type="email" required placeholder="person@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Select label="Role" required value={role} onChange={(e) => setRole(e.target.value as ProjectRoleValue)}
              options={assignable.map((r) => ({ label: projectRoleLabel(r), value: r }))} />
            <div style={{ gridColumn: 'span 2' }}>
              <Button type="submit" variant="primary" disabled={submitting} icon={<UserPlus size={16} />}>
                {submitting ? 'Assigning…' : 'Assign / Invite'}
              </Button>
              <span className="qms-text-sm text-muted" style={{ marginLeft: 12 }}>
                Existing company users are added directly; new emails get an invitation.
              </span>
            </div>
          </form>
        </Card>
      )}

      <Card className="qms-form-section" padding="none">
        <div className="qms-p-4 qms-border-b">
          <h3 className="qms-section-heading-plain">Team members</h3>
        </div>
        <div className="qms-table-container">
          <table className="qms-table">
            <thead>
              <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="text-muted">Loading…</td></tr>
              ) : members.length === 0 ? (
                <tr><td colSpan={4} className="text-muted">No team members yet.</td></tr>
              ) : (
                members.map((m) => (
                  <tr key={m.email}>
                    <td className="font-medium">{m.full_name ?? '—'}</td>
                    <td>{m.email}</td>
                    <td>{projectRoleLabel(m.project_role)}</td>
                    <td><Badge variant={STATUS_BADGE[m.status].variant}>{STATUS_BADGE[m.status].label}</Badge></td>
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
