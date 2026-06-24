import React, { useCallback, useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Plus, FlaskConical, Factory } from 'lucide-react';
import { useProject } from '../../components/layout/ProjectLayout';
import { projectsApi } from '../../api/projects';
import { suppliersApi } from '../../api/suppliers';
import { labsApi } from '../../api/labs';
import { getApiErrorMessage } from '../../api/client';
import type {
  ConfirmationStatus,
  ContractorLinkStatus,
  LabResponse,
  ProjectContractor,
  SupplierResponse,
  TowerResponse,
} from '../../types/master';

const STATUS_BADGE: Record<ContractorLinkStatus, { variant: 'pass' | 'pending' | 'fail'; label: string }> = {
  ACCEPTED: { variant: 'pass', label: 'Accepted' },
  PENDING: { variant: 'pending', label: 'Pending' },
  DECLINED: { variant: 'fail', label: 'Declined' },
};

const CONF_VARIANT: Record<ConfirmationStatus, 'pass' | 'warn' | 'fail'> = {
  CONFIRMED: 'pass', PENDING: 'warn', DECLINED: 'fail',
};
const CONF_LABEL: Record<ConfirmationStatus, string> = {
  CONFIRMED: 'Confirmed', PENDING: 'Pending', DECLINED: 'Declined',
};

// One contractor's hired suppliers / labs, listed under its card.
const HiredList: React.FC<{
  icon: React.ReactNode;
  title: string;
  items: { id: number; name: string; status: ConfirmationStatus }[];
}> = ({ icon, title, items }) => (
  <div style={{ flex: 1, minWidth: 220 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, color: 'var(--gray-600)' }}>
      {icon}
      <span className="qms-text-sm font-medium">{title}</span>
    </div>
    {items.length === 0 ? (
      <p className="qms-text-sm text-muted" style={{ margin: 0 }}>None yet.</p>
    ) : (
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map((it) => (
          <li key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <span>{it.name}</span>
            <Badge variant={CONF_VARIANT[it.status]}>{CONF_LABEL[it.status]}</Badge>
          </li>
        ))}
      </ul>
    )}
  </div>
);

export const ProjectContractors: React.FC = () => {
  const { project } = useProject();
  const pid = project.project_id;
  const canManage = project.access.can_manage_client_side;

  const [rows, setRows] = useState<ProjectContractor[]>([]);
  const [towers, setTowers] = useState<TowerResponse[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierResponse[]>([]);
  const [labs, setLabs] = useState<LabResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgName, setOrgName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [towerIds, setTowerIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pcs, tw, sup, lb] = await Promise.all([
        projectsApi.contractors(pid),
        projectsApi.towers(pid),
        suppliersApi.list(pid),
        labsApi.list(pid),
      ]);
      setRows(pcs);
      setTowers(tw);
      setSuppliers(sup);
      setLabs(lb);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to load contractors.'));
    } finally {
      setLoading(false);
    }
  }, [pid]);

  useEffect(() => { void load(); }, [load]);

  const toggleTower = (id: number) =>
    setTowerIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));

  // Towers already allotted to another (non-declined) contractor — derived from
  // their readable scope label so the same tower can't be handed out twice.
  const wholeProjectBy =
    rows.find((c) => c.status !== 'DECLINED' && (!c.scope || c.scope === 'Entire project'))
      ?.contractor_org_name ?? null;
  const takenBy: Record<string, string> = {};
  rows.forEach((c) => {
    if (c.status === 'DECLINED' || !c.scope || c.scope === 'Entire project') return;
    c.scope.split(',').forEach((name) => { takenBy[name.trim()] = c.contractor_org_name; });
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setSuccess(null); setSubmitting(true);
    try {
      const pc = await projectsApi.addContractor(pid, {
        org_name: orgName.trim(),
        contact_email: email.trim(),
        contact_phone: phone.trim() || null,
        tower_ids: towerIds,
      });
      setSuccess(`${pc.contractor_org_name} invited — they'll accept the project after activating.`);
      setOrgName(''); setEmail(''); setPhone(''); setTowerIds([]);
      void load();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to add contractor.'));
    } finally {
      setSubmitting(false);
    }
  };

  const alert: React.CSSProperties = { padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 14 };

  return (
    <div>
      {error && <div style={{ ...alert, background: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5' }}>{error}</div>}
      {success && <div style={{ ...alert, background: '#DCFCE7', color: '#166534', border: '1px solid #86EFAC' }}>{success}</div>}

      {canManage && (
        <Card className="qms-form-section">
          <h3 className="qms-section-heading-plain" style={{ marginBottom: 12 }}>Bring a contractor onto this project</h3>
          <form onSubmit={handleSubmit} className="qms-grid-2">
            <Input label="Contractor company name" required value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="e.g. L&T Construction" />
            <Input label="Contractor admin email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@contractor.com" />
            <Input label="Phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" />
            <div style={{ gridColumn: 'span 2' }}>
              <label className="qms-input-label" style={{ display: 'block', marginBottom: 6 }}>Towers this contractor works on</label>
              {towers.length === 0 ? (
                <p className="qms-text-sm text-muted" style={{ margin: 0 }}>No towers on this project yet — the contractor will cover the entire project.</p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {towers.map((t) => {
                    const takenByName = wholeProjectBy ?? takenBy[t.tower_name];
                    const isTaken = !!takenByName;
                    const checked = towerIds.includes(t.tower_id);
                    return (
                      <label
                        key={t.tower_id}
                        title={isTaken ? `Already assigned to ${takenByName}` : undefined}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          cursor: isTaken ? 'not-allowed' : 'pointer',
                          padding: '6px 12px', borderRadius: 8, fontSize: 13,
                          border: `1px solid ${checked ? 'var(--blue-500, #3B82F6)' : 'var(--gray-200)'}`,
                          background: isTaken ? 'var(--gray-100)' : checked ? 'var(--blue-50, #EFF6FF)' : 'var(--gray-50, #F9FAFB)',
                          color: isTaken ? 'var(--gray-400)' : checked ? 'var(--blue-700, #1D4ED8)' : 'var(--gray-700)',
                          textDecoration: isTaken ? 'line-through' : 'none',
                        }}
                      >
                        <input type="checkbox" checked={checked} disabled={isTaken} onChange={() => toggleTower(t.tower_id)} />
                        {t.tower_name}{isTaken ? ' · taken' : ''}
                      </label>
                    );
                  })}
                </div>
              )}
              <p className="qms-text-sm text-muted" style={{ marginTop: 6, marginBottom: 0 }}>
                Leave all unchecked for the entire project.
              </p>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <Button type="submit" variant="primary" disabled={submitting} icon={<Plus size={16} />}>
                {submitting ? 'Sending…' : 'Add contractor'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="qms-form-section" padding="none">
        <div className="qms-p-4 qms-border-b">
          <h3 className="qms-section-heading-plain">Contractors on this project</h3>
        </div>
        <div className="qms-p-4" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loading ? (
            <p className="text-muted qms-text-sm">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-muted qms-text-sm">No contractors yet.</p>
          ) : (
            rows.map((c) => {
              const theirSuppliers = suppliers
                .filter((s) => s.contractor_org_id === c.contractor_org_id)
                .map((s) => ({ id: s.supplier_id, name: s.supplier_name, status: s.status }));
              const theirLabs = labs
                .filter((l) => l.contractor_org_id === c.contractor_org_id)
                .map((l) => ({ id: l.lab_id, name: l.lab_name, status: l.status }));
              return (
                <Card key={c.pc_id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="font-medium" style={{ fontSize: 15 }}>{c.contractor_org_name}</span>
                        <Badge variant={STATUS_BADGE[c.status].variant}>{STATUS_BADGE[c.status].label}</Badge>
                      </div>
                      <p className="qms-text-sm text-muted" style={{ margin: '4px 0 0' }}>
                        Scope: {c.scope ?? 'Entire project'} · Added {new Date(c.assigned_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginTop: 14 }}>
                    <HiredList icon={<Factory size={14} />} title="RMC suppliers" items={theirSuppliers} />
                    <HiredList icon={<FlaskConical size={14} />} title="Testing labs" items={theirLabs} />
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
};
