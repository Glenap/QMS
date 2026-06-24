import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Plus, FlaskConical, Factory, ChevronRight, AlertTriangle } from 'lucide-react';
import { useProject } from '../../components/layout/ProjectLayout';
import { projectsApi } from '../../api/projects';
import { suppliersApi } from '../../api/suppliers';
import { labsApi } from '../../api/labs';
import { getApiErrorMessage } from '../../api/client';
import type {
  AvailableContractor,
  ContractorLinkStatus,
  LabResponse,
  ProjectContractor,
  ProjectContractorCreate,
  SupplierResponse,
  TowerResponse,
} from '../../types/master';

const STATUS_BADGE: Record<ContractorLinkStatus, { variant: 'pass' | 'pending' | 'fail'; label: string }> = {
  ACCEPTED: { variant: 'pass', label: 'Accepted' },
  PENDING: { variant: 'pending', label: 'Pending' },
  DECLINED: { variant: 'fail', label: 'Declined' },
};

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString() : '—');

// A small "N suppliers · M labs" summary shown on each contractor card.
const Tally: React.FC<{ icon: React.ReactNode; n: number; noun: string }> = ({ icon, n, noun }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--gray-600)', fontSize: 13 }}>
    {icon}
    {n} {noun}{n === 1 ? '' : 's'}
  </span>
);

export const ProjectContractors: React.FC = () => {
  const { project } = useProject();
  const navigate = useNavigate();
  const pid = project.project_id;
  const canManage = project.access.can_manage_client_side;

  const [rows, setRows] = useState<ProjectContractor[]>([]);
  const [towers, setTowers] = useState<TowerResponse[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierResponse[]>([]);
  const [labs, setLabs] = useState<LabResponse[]>([]);
  const [available, setAvailable] = useState<AvailableContractor[]>([]);
  const [loading, setLoading] = useState(true);

  // Add-contractor form (hidden until "Add contractor" is clicked).
  const [showForm, setShowForm] = useState(false);
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [orgName, setOrgName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [towerIds, setTowerIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<AvailableContractor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pcs, tw, sup, lb, avail] = await Promise.all([
        projectsApi.contractors(pid),
        projectsApi.towers(pid),
        suppliersApi.list(pid),
        labsApi.list(pid),
        canManage ? projectsApi.availableContractors(pid) : Promise.resolve([] as AvailableContractor[]),
      ]);
      setRows(pcs);
      setTowers(tw);
      setSuppliers(sup);
      setLabs(lb);
      setAvailable(avail);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to load contractors.'));
    } finally {
      setLoading(false);
    }
  }, [pid, canManage]);

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

  const resetForm = () => {
    setOrgName(''); setEmail(''); setPhone(''); setSelectedOrgId(''); setTowerIds([]); setMode('new');
  };

  // The single place that calls the API — used by both the new-contractor flow
  // and the "assign anyway" confirmation for an already-engaged contractor.
  const doSubmit = async (payload: ProjectContractorCreate) => {
    setError(null); setSuccess(null); setSubmitting(true);
    try {
      const pc = await projectsApi.addContractor(pid, payload);
      setSuccess(
        payload.contractor_org_id
          ? `${pc.contractor_org_name} assigned — they'll accept the project from their dashboard.`
          : `${pc.contractor_org_name} invited — they'll accept the project after activating.`,
      );
      resetForm();
      setShowForm(false);
      setConfirmTarget(null);
      void load();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to add contractor.'));
      setConfirmTarget(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'existing') {
      const chosen = available.find((a) => a.contractor_org_id === Number(selectedOrgId));
      if (!chosen) { setError('Pick a contractor from the list.'); return; }
      // Busy elsewhere → confirm first; otherwise assign straight away.
      if (chosen.engagements.length > 0) { setError(null); setConfirmTarget(chosen); return; }
      void doSubmit({ contractor_org_id: chosen.contractor_org_id, tower_ids: towerIds });
    } else {
      void doSubmit({
        org_name: orgName.trim(),
        contact_email: email.trim(),
        contact_phone: phone.trim() || null,
        tower_ids: towerIds,
      });
    }
  };

  const alert: React.CSSProperties = { padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 14 };

  return (
    <div>
      {error && <div style={{ ...alert, background: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5' }}>{error}</div>}
      {success && <div style={{ ...alert, background: '#DCFCE7', color: '#166534', border: '1px solid #86EFAC' }}>{success}</div>}

      {canManage && showForm && (
        <Card className="qms-form-section">
          <h3 className="qms-section-heading-plain" style={{ marginBottom: 12 }}>Bring a contractor onto this project</h3>

          {available.length > 0 && (
            <div style={{ display: 'inline-flex', borderRadius: 8, border: '1px solid var(--gray-200)', overflow: 'hidden', marginBottom: 16 }}>
              {(['new', 'existing'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMode(m); setError(null); }}
                  style={{
                    padding: '8px 16px', border: 'none', cursor: 'pointer', font: 'inherit', fontSize: 13,
                    fontWeight: mode === m ? 600 : 500,
                    background: mode === m ? 'var(--blue-50, #EFF6FF)' : '#fff',
                    color: mode === m ? 'var(--blue-700, #1D4ED8)' : 'var(--gray-600)',
                  }}
                >
                  {m === 'new' ? 'New contractor' : 'Existing contractor'}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="qms-grid-2">
            {mode === 'existing' ? (
              <div style={{ gridColumn: 'span 2' }}>
                <Select
                  label="Contractor"
                  required
                  value={selectedOrgId}
                  onChange={(e) => setSelectedOrgId(e.target.value)}
                  options={[
                    { label: 'Select a contractor you already work with…', value: '' },
                    ...available.map((a) => ({
                      label: a.engagements.length ? `${a.org_name} · busy on ${a.engagements.length} project${a.engagements.length === 1 ? '' : 's'}` : a.org_name,
                      value: String(a.contractor_org_id),
                    })),
                  ]}
                />
                <p className="qms-text-sm text-muted" style={{ marginTop: 6, marginBottom: 0 }}>
                  Re-uses the same contractor company. Their team for this project is assigned separately.
                </p>
              </div>
            ) : (
              <>
                <Input label="Contractor company name" required value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="e.g. L&T Construction" />
                <Input label="Contractor admin email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@contractor.com" />
                <Input label="Phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" />
                {available.length > 0 && (
                  <p className="qms-text-sm text-muted" style={{ gridColumn: 'span 2', margin: 0 }}>
                    Already worked with this contractor? Switch to <strong>Existing contractor</strong> instead of re-inviting them.
                  </p>
                )}
              </>
            )}

            <div style={{ gridColumn: 'span 2' }}>
              <label className="qms-input-label" style={{ display: 'block', marginBottom: 6 }}>Towers this contractor works on</label>
              {towers.length === 0 ? (
                <p className="qms-text-sm text-muted" style={{ margin: 0 }}>No towers on this project yet — the contractor will cover the entire project.</p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {towers.map((t) => {
                    const takenByName = wholeProjectBy ?? takenBy[t.tower_name];
                    const isTaken = !!takenByName;
                    // Taken towers show as a dimmed, ticked chip (allotted elsewhere).
                    const checked = isTaken || towerIds.includes(t.tower_id);
                    return (
                      <label
                        key={t.tower_id}
                        title={isTaken ? `Already assigned to ${takenByName}` : undefined}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 8,
                          cursor: isTaken ? 'not-allowed' : 'pointer',
                          padding: '10px 16px', borderRadius: 10, fontSize: 14,
                          opacity: isTaken ? 0.55 : 1,
                          border: `1px solid ${checked ? 'var(--blue-500, #3B82F6)' : 'var(--gray-200)'}`,
                          background: checked ? 'var(--blue-50, #EFF6FF)' : 'var(--gray-50, #F9FAFB)',
                          color: checked ? 'var(--blue-700, #1D4ED8)' : 'var(--gray-700)',
                        }}
                      >
                        <input type="checkbox" checked={checked} disabled={isTaken} onChange={() => toggleTower(t.tower_id)} />
                        {t.tower_name}
                      </label>
                    );
                  })}
                </div>
              )}
              <p className="qms-text-sm text-muted" style={{ marginTop: 6, marginBottom: 0 }}>
                Leave all unchecked for the entire project. Dimmed towers are already assigned to another contractor.
              </p>
            </div>

            <div style={{ gridColumn: 'span 2', display: 'flex', gap: 8 }}>
              <Button type="submit" variant="primary" disabled={submitting} icon={<Plus size={16} />}>
                {submitting ? 'Sending…' : mode === 'existing' ? 'Assign contractor' : 'Add contractor'}
              </Button>
              <Button type="button" variant="ghost" disabled={submitting} onClick={() => { setShowForm(false); resetForm(); setError(null); }}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="qms-form-section" padding="none">
        <div className="qms-p-4 qms-border-b" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <h3 className="qms-section-heading-plain">Contractors on this project</h3>
          {canManage && !showForm && (
            <Button variant="primary" size="sm" icon={<Plus size={15} />} onClick={() => setShowForm(true)}>
              Add contractor
            </Button>
          )}
        </div>
        <div className="qms-p-4" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loading ? (
            <p className="text-muted qms-text-sm">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-muted qms-text-sm">No contractors yet.</p>
          ) : (
            rows.map((c) => {
              const supCount = suppliers.filter((s) => s.contractor_org_id === c.contractor_org_id).length;
              const labCount = labs.filter((l) => l.contractor_org_id === c.contractor_org_id).length;
              return (
                <Card
                  key={c.pc_id}
                  onClick={() => navigate(`/app/projects/${pid}/contractors/${c.contractor_org_id}`)}
                  style={{ cursor: 'pointer' }}
                >
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
                    <ChevronRight size={18} className="text-muted" style={{ flexShrink: 0 }} />
                  </div>
                  <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 12 }}>
                    <Tally icon={<Factory size={14} />} n={supCount} noun="RMC supplier" />
                    <Tally icon={<FlaskConical size={14} />} n={labCount} noun="testing lab" />
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </Card>

      {confirmTarget && (
        <div
          role="dialog"
          aria-modal="true"
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}
          onClick={() => !submitting && setConfirmTarget(null)}
        >
          <Card style={{ maxWidth: 480, width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ color: 'var(--amber, #D97706)', display: 'flex' }}><AlertTriangle size={20} /></span>
              <h3 className="qms-section-heading-plain" style={{ margin: 0 }}>Contractor already engaged</h3>
            </div>
            <p className="qms-text-sm" style={{ marginTop: 0 }}>
              <strong>{confirmTarget.org_name}</strong> is currently engaged on:
            </p>
            <ul style={{ listStyle: 'none', margin: '0 0 12px', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {confirmTarget.engagements.map((eng) => (
                <li key={eng.project_id} style={{ border: '1px solid var(--gray-200)', borderRadius: 8, padding: '8px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="font-medium" style={{ fontSize: 14 }}>{eng.project_name}</span>
                    <Badge variant={STATUS_BADGE[eng.status].variant}>{STATUS_BADGE[eng.status].label}</Badge>
                  </div>
                  <div className="qms-text-sm text-muted" style={{ marginTop: 2 }}>
                    {fmtDate(eng.start_date)} → {fmtDate(eng.end_date)}
                  </div>
                </li>
              ))}
            </ul>
            <p className="qms-text-sm text-muted" style={{ marginTop: 0 }}>
              You can still assign them. Note their contractor users (project managers, quality engineers,
              supervisors) on this project must be different from those on their other projects.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <Button variant="ghost" disabled={submitting} onClick={() => setConfirmTarget(null)}>Cancel</Button>
              <Button
                variant="primary"
                disabled={submitting}
                onClick={() => void doSubmit({ contractor_org_id: confirmTarget.contractor_org_id, tower_ids: towerIds })}
              >
                {submitting ? 'Assigning…' : 'Assign anyway'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
