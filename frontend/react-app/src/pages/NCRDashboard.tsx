import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  AlertTriangle, CheckCircle, Clock, ChevronDown, ChevronRight, Plus, Gavel,
  Sparkles, ShieldAlert, Wand2,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { useProject } from '../components/layout/ProjectLayout';
import { useAuth } from '../hooks/useAuth';
import { ncrsApi } from '../api/ncrs';
import { aiSuggestionsApi } from '../api/aiSuggestions';
import { getApiErrorMessage } from '../api/client';
import type {
  ActionStatus,
  AISuggestionResponse,
  ConfidenceLevel,
  NCRDetailResponse,
  NCRResponse,
  NCRStatus,
  PenaltyType,
  ResultStatus,
} from '../types/master';
import './NCRDashboard.css';

const STATUS_BADGE: Record<NCRStatus, { variant: 'pass' | 'warn' | 'pending'; label: string; icon?: React.ReactNode }> = {
  OPEN: { variant: 'pending', label: 'Open' },
  UNDER_REVIEW: { variant: 'warn', label: 'Under review', icon: <Clock size={12} /> },
  CLOSED: { variant: 'pass', label: 'Closed', icon: <CheckCircle size={12} /> },
};

const ACTION_BADGE: Record<ActionStatus, { variant: 'pass' | 'warn' | 'pending'; label: string }> = {
  PENDING: { variant: 'pending', label: 'Pending' },
  IN_PROGRESS: { variant: 'warn', label: 'In progress' },
  COMPLETED: { variant: 'pass', label: 'Completed' },
};

const ACTION_STATUS_OPTIONS = [
  { label: 'Pending', value: 'PENDING' },
  { label: 'In progress', value: 'IN_PROGRESS' },
  { label: 'Completed', value: 'COMPLETED' },
];

const PENALTY_LABEL: Record<PenaltyType, string> = {
  RATE_REDUCTION: 'Rate reduction',
  REJECTION: 'Rejection',
  DEMOLITION: 'Demolition',
};
const PENALTY_OPTIONS = Object.entries(PENALTY_LABEL).map(([value, label]) => ({ value, label }));

const severityBadge = (result: ResultStatus | null) =>
  result === 'CRITICAL_FAILURE'
    ? <Badge variant="fail">Critical</Badge>
    : <Badge variant="warn">High</Badge>;

const fmtDate = (iso: string | null): string => (iso ? new Date(iso).toLocaleDateString() : '—');

const issueText = (n: NCRResponse): string => {
  const grade = n.grade_name ?? 'concrete';
  if (n.observed_strength_mpa != null && n.required_strength_mpa != null) {
    const verb = n.result_status === 'CRITICAL_FAILURE' ? 'critical cube failure' : 'cube test failure';
    return `${grade} ${verb} — ${n.observed_strength_mpa} / ${n.required_strength_mpa} MPa @ ${n.test_age_days ?? '?'}d`;
  }
  return `${grade} cube test failure`;
};

const location = (n: NCRResponse) =>
  [n.tower_name, n.floor_label, n.component_type].filter(Boolean).join(' · ') || '—';

const errorBox = (msg: string) => (
  <div style={{ padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 14, background: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5' }}>
    {msg}
  </div>
);

export const NCRDashboard: React.FC = () => {
  const { project } = useProject();
  const { user } = useAuth();
  const pid = project.project_id;
  const isQE = user?.role === 'QUALITY_ENGINEER';

  const [rows, setRows] = useState<NCRResponse[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await ncrsApi.list(pid));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to load NCRs.'));
    } finally {
      setLoading(false);
    }
  }, [pid]);

  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => ({
    open: rows.filter((n) => n.status !== 'CLOSED').length,
    critical: rows.filter((n) => n.result_status === 'CRITICAL_FAILURE').length,
    closed: rows.filter((n) => n.status === 'CLOSED').length,
  }), [rows]);

  return (
    <div className="qms-page">
      <div className="qms-page-header">
        <div>
          <h1 className="qms-page-title">Non-Conformance Reports</h1>
          <p className="qms-page-sub">
            NCRs auto-raised when a cube test falls below its required strength (IS 456).
            {isQE ? ' Review, log corrective actions and penalties, then close them out.' : ''}
          </p>
        </div>
      </div>

      {error && errorBox(error)}

      <div className="qms-ncr-kpis">
        <Card className="qms-ncr-kpi-card" padding="sm">
          <div className="qms-ncr-kpi-header">
            <AlertTriangle size={20} className="text-danger" />
            <span className="qms-ncr-kpi-title">Open NCRs</span>
          </div>
          <div className="qms-ncr-kpi-val">{counts.open}</div>
        </Card>
        <Card className="qms-ncr-kpi-card" padding="sm">
          <div className="qms-ncr-kpi-header">
            <AlertTriangle size={20} className="text-warning" />
            <span className="qms-ncr-kpi-title">Critical failures</span>
          </div>
          <div className="qms-ncr-kpi-val">{counts.critical}</div>
        </Card>
        <Card className="qms-ncr-kpi-card" padding="sm">
          <div className="qms-ncr-kpi-header">
            <CheckCircle size={20} className="text-success" />
            <span className="qms-ncr-kpi-title">Closed</span>
          </div>
          <div className="qms-ncr-kpi-val">{counts.closed}</div>
        </Card>
      </div>

      <Card padding="none" className="qms-ncr-list-card">
        <div className="qms-table-container">
          <table className="qms-table">
            <thead>
              <tr>
                <th style={{ width: 32 }}></th>
                <th>NCR</th>
                <th>Issue</th>
                <th>Location</th>
                <th>Severity</th>
                <th>Actions</th>
                <th>Status</th>
                <th>Raised</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-muted">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="text-muted">No NCRs — every cube test has passed so far.</td></tr>
              ) : (
                rows.map((n) => {
                  const s = STATUS_BADGE[n.status];
                  const open = expandedId === n.ncr_id;
                  return (
                    <React.Fragment key={n.ncr_id}>
                      <tr style={{ cursor: 'pointer' }} onClick={() => setExpandedId(open ? null : n.ncr_id)}>
                        <td>{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</td>
                        <td className="font-medium text-primary">{n.ncr_number ?? `NCR-${n.ncr_id}`}</td>
                        <td className="font-medium">{issueText(n)}</td>
                        <td>{location(n)}</td>
                        <td>{severityBadge(n.result_status)}</td>
                        <td>
                          {n.corrective_action_count === 0
                            ? <span className="text-muted">—</span>
                            : <span>{n.corrective_action_count - n.open_action_count}/{n.corrective_action_count} done</span>}
                          {n.penalty_count > 0 && (
                            <span className="text-muted" style={{ marginLeft: 6, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              <Gavel size={12} /> {n.penalty_count}
                            </span>
                          )}
                        </td>
                        <td><Badge variant={s.variant} icon={s.icon}>{s.label}</Badge></td>
                        <td>{fmtDate(n.raised_at)}</td>
                      </tr>
                      {open && (
                        <tr>
                          <td colSpan={8} style={{ background: 'var(--gray-50, #F9FAFB)' }}>
                            <NCRDetailPanel pid={pid} ncrId={n.ncr_id} isQE={!!isQE} onChanged={load} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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

// ── Detail panel ──────────────────────────────────────────────────────────────

interface PanelProps {
  pid: number;
  ncrId: number;
  isQE: boolean;
  onChanged: () => void; // refresh the parent list (counts / status)
}

const NCRDetailPanel: React.FC<PanelProps> = ({ pid, ncrId, isQE, onChanged }) => {
  const [ncr, setNcr] = useState<NCRDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [rootCause, setRootCause] = useState('');
  const [actionDesc, setActionDesc] = useState('');
  const [actionDue, setActionDue] = useState('');
  const [penaltyType, setPenaltyType] = useState<PenaltyType>('RATE_REDUCTION');
  const [penaltyAmount, setPenaltyAmount] = useState('');
  const [penaltyDesc, setPenaltyDesc] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await ncrsApi.get(pid, ncrId);
      setNcr(d);
      setRootCause(d.root_cause ?? '');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to load NCR.'));
    } finally {
      setLoading(false);
    }
  }, [pid, ncrId]);

  useEffect(() => { void load(); }, [load]);

  // Run a mutation, then refresh both this panel and the parent list.
  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    setBusy(true);
    try {
      await fn();
      await load();
      onChanged();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Action failed.'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="text-muted" style={{ padding: 12 }}>Loading…</p>;
  if (!ncr) return <p className="text-danger" style={{ padding: 12 }}>{error ?? 'Not found.'}</p>;

  const isClosed = ncr.status === 'CLOSED';

  const saveRootCause = () => run(() => ncrsApi.update(pid, ncrId, { root_cause: rootCause.trim() || null }));
  const setStatus = (status: NCRStatus) => run(() => ncrsApi.update(pid, ncrId, { status }));
  const addAction = () => run(async () => {
    await ncrsApi.addCorrectiveAction(pid, ncrId, {
      action_description: actionDesc.trim(),
      due_date: actionDue || null,
    });
    setActionDesc(''); setActionDue('');
  });
  const setActionStatus = (actionId: number, status: ActionStatus) =>
    run(() => ncrsApi.updateCorrectiveAction(pid, ncrId, actionId, { status }));
  const addPenalty = () => run(async () => {
    await ncrsApi.addPenalty(pid, ncrId, {
      penalty_type: penaltyType,
      amount: penaltyAmount ? Number(penaltyAmount) : null,
      description: penaltyDesc.trim() || null,
    });
    setPenaltyAmount(''); setPenaltyDesc('');
  });

  return (
    <div style={{ padding: '14px 8px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {error && errorBox(error)}

      {/* Status + transitions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Badge variant={STATUS_BADGE[ncr.status].variant} icon={STATUS_BADGE[ncr.status].icon}>
          {STATUS_BADGE[ncr.status].label}
        </Badge>
        {ncr.raised_by_name && <span className="qms-text-sm text-muted">Raised by {ncr.raised_by_name}</span>}
        {ncr.closed_at && <span className="qms-text-sm text-muted">Closed {fmtDate(ncr.closed_at)}</span>}
        {isQE && (
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            {ncr.status === 'OPEN' && (
              <Button size="sm" variant="primary" disabled={busy} onClick={() => setStatus('UNDER_REVIEW')}>Start review</Button>
            )}
            {ncr.status === 'UNDER_REVIEW' && (
              <>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => setStatus('OPEN')}>Back to open</Button>
                <Button size="sm" variant="primary" disabled={busy} onClick={() => setStatus('CLOSED')}>Close NCR</Button>
              </>
            )}
            {ncr.status === 'CLOSED' && (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => setStatus('UNDER_REVIEW')}>Reopen</Button>
            )}
          </div>
        )}
      </div>

      {/* AI suggestion (Phase 9 — RAG over past resolved NCRs) */}
      <AISuggestionSection
        pid={pid}
        ncrId={ncrId}
        isQE={isQE}
        isClosed={isClosed}
        onApplied={async () => { await load(); onChanged(); }}
      />

      {/* Root cause */}
      <div>
        <h4 className="qms-section-heading" style={{ marginBottom: 6 }}>Root cause</h4>
        {isQE && !isClosed ? (
          <>
            <textarea
              value={rootCause}
              onChange={(e) => setRootCause(e.target.value)}
              rows={2}
              placeholder="What caused this non-conformance?"
              style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--gray-300, #D1D5DB)', fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }}
            />
            <div style={{ marginTop: 8 }}>
              <Button size="sm" variant="outline" disabled={busy || rootCause.trim() === (ncr.root_cause ?? '')} onClick={saveRootCause}>
                Save root cause
              </Button>
            </div>
          </>
        ) : (
          <p className={ncr.root_cause ? '' : 'text-muted'} style={{ fontSize: 14 }}>{ncr.root_cause ?? 'Not recorded yet.'}</p>
        )}
      </div>

      {/* Corrective actions */}
      <div>
        <h4 className="qms-section-heading" style={{ marginBottom: 6 }}>Corrective actions</h4>
        {ncr.corrective_actions.length === 0 ? (
          <p className="text-muted" style={{ fontSize: 14, margin: '4px 0' }}>None logged yet.</p>
        ) : (
          <table className="qms-table" style={{ marginBottom: 10 }}>
            <thead>
              <tr><th>Action</th><th>Assigned</th><th>Due</th><th>Status</th></tr>
            </thead>
            <tbody>
              {ncr.corrective_actions.map((a) => (
                <tr key={a.action_id}>
                  <td>{a.action_description}</td>
                  <td>{a.assigned_to_name ?? '—'}</td>
                  <td>{fmtDate(a.due_date)}</td>
                  <td>
                    {isQE && !isClosed ? (
                      <Select
                        value={a.status}
                        onChange={(e) => setActionStatus(a.action_id, e.target.value as ActionStatus)}
                        options={ACTION_STATUS_OPTIONS}
                      />
                    ) : (
                      <Badge variant={ACTION_BADGE[a.status].variant}>{ACTION_BADGE[a.status].label}</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {isQE && !isClosed && (
          <div className="qms-grid-3" style={{ alignItems: 'end' }}>
            <Input label="New action" value={actionDesc} onChange={(e) => setActionDesc(e.target.value)} placeholder="e.g. Re-pour affected section" />
            <Input label="Due date" type="date" value={actionDue} onChange={(e) => setActionDue(e.target.value)} />
            <div>
              <Button size="sm" variant="outline" icon={<Plus size={14} />} disabled={busy || actionDesc.trim() === ''} onClick={addAction}>
                Add action
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Penalties */}
      <div>
        <h4 className="qms-section-heading" style={{ marginBottom: 6 }}>Penalties</h4>
        {ncr.penalties.length === 0 ? (
          <p className="text-muted" style={{ fontSize: 14, margin: '4px 0' }}>None applied.</p>
        ) : (
          <table className="qms-table" style={{ marginBottom: 10 }}>
            <thead>
              <tr><th>Type</th><th>Amount</th><th>Notes</th><th>Applied by</th></tr>
            </thead>
            <tbody>
              {ncr.penalties.map((p) => (
                <tr key={p.penalty_id}>
                  <td className="font-medium">{PENALTY_LABEL[p.penalty_type]}</td>
                  <td>{p.amount != null ? p.amount.toLocaleString() : '—'}</td>
                  <td>{p.description ?? '—'}</td>
                  <td>{p.applied_by_name ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {isQE && !isClosed && (
          <div className="qms-grid-3" style={{ alignItems: 'end' }}>
            <Select
              label="Penalty type"
              value={penaltyType}
              onChange={(e) => setPenaltyType(e.target.value as PenaltyType)}
              options={PENALTY_OPTIONS}
            />
            <Input label="Amount (optional)" type="number" min="0" value={penaltyAmount} onChange={(e) => setPenaltyAmount(e.target.value)} />
            <Input label="Notes (optional)" value={penaltyDesc} onChange={(e) => setPenaltyDesc(e.target.value)} />
            <div>
              <Button size="sm" variant="outline" icon={<Gavel size={14} />} disabled={busy} onClick={addPenalty}>
                Apply penalty
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── AI suggestion section ─────────────────────────────────────────────────────

const CONFIDENCE_BADGE: Record<ConfidenceLevel, { variant: 'pass' | 'warn' | 'pending'; label: string }> = {
  HIGH: { variant: 'pass', label: 'High confidence' },
  MEDIUM: { variant: 'warn', label: 'Medium confidence' },
  LOW: { variant: 'pending', label: 'Low confidence' },
};

interface AIProps {
  pid: number;
  ncrId: number;
  isQE: boolean;
  isClosed: boolean;
  onApplied: () => Promise<void>;
}

const AISuggestionSection: React.FC<AIProps> = ({ pid, ncrId, isQE, isClosed, onApplied }) => {
  const [suggestion, setSuggestion] = useState<AISuggestionResponse | null>(null);
  const [showSources, setShowSources] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load any existing suggestion. A 404 just means none generated yet; any other
  // error is real and surfaced rather than silently swallowed.
  useEffect(() => {
    let live = true;
    aiSuggestionsApi
      .get(pid, ncrId)
      .then((s) => { if (live) setSuggestion(s); })
      .catch((err) => {
        if (!live) return;
        if (axios.isAxiosError(err) && err.response?.status === 404) return;
        setError(getApiErrorMessage(err, 'Unable to load the AI suggestion.'));
      });
    return () => { live = false; };
  }, [pid, ncrId]);

  const generate = async () => {
    setError(null);
    setBusy(true);
    try {
      setSuggestion(await aiSuggestionsApi.generate(pid, ncrId));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not generate a suggestion.'));
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    setError(null);
    setBusy(true);
    try {
      await aiSuggestionsApi.apply(pid, ncrId);
      await onApplied();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not apply the suggestion.'));
    } finally {
      setBusy(false);
    }
  };

  // Nothing to show for non-QE viewers until a suggestion has been generated
  // (but still surface a load error if one occurred).
  if (!isQE && !suggestion && !error) return null;

  const conf = suggestion?.confidence_level ? CONFIDENCE_BADGE[suggestion.confidence_level] : null;

  return (
    <div className="qms-ai-suggestion">
      <div className="qms-ai-suggestion-head">
        <h4 className="qms-section-heading" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Sparkles size={15} className="text-primary" /> AI suggestion
        </h4>
        {isQE && (
          <Button
            size="sm"
            variant="outline"
            icon={<Wand2 size={14} />}
            disabled={busy}
            onClick={generate}
          >
            {busy ? 'Analysing…' : suggestion ? 'Regenerate' : 'Suggest root cause & actions'}
          </Button>
        )}
      </div>

      {error && errorBox(error)}

      {!suggestion ? (
        <p className="text-muted" style={{ fontSize: 13, margin: '6px 0 0' }}>
          {isQE
            ? 'Generate a probable root cause and corrective actions, grounded in similar past resolved NCRs on this project.'
            : 'No AI suggestion yet.'}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {conf && <Badge variant={conf.variant}>{conf.label}</Badge>}
            {suggestion.ndt_recommended && (
              <Badge variant="fail" icon={<ShieldAlert size={12} />}>NDT / core test recommended</Badge>
            )}
            <span className="text-muted" style={{ fontSize: 12 }}>
              {suggestion.retrieved.length > 0
                ? `Grounded in ${suggestion.retrieved.length} past NCR${suggestion.retrieved.length > 1 ? 's' : ''}`
                : 'No similar past NCRs — based on general practice'}
            </span>
          </div>

          {suggestion.root_cause_text && (
            <div>
              <div className="qms-ai-label">Probable root cause</div>
              <p style={{ fontSize: 14, margin: '2px 0 0' }}>{suggestion.root_cause_text}</p>
            </div>
          )}

          {suggestion.corrective_actions.length > 0 && (
            <div>
              <div className="qms-ai-label">Suggested corrective actions</div>
              <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 14 }}>
                {suggestion.corrective_actions.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </div>
          )}

          {suggestion.retrieved.length > 0 && (
            <div>
              <button
                type="button"
                className="qms-ai-sources-toggle"
                onClick={() => setShowSources((v) => !v)}
              >
                {showSources ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                {showSources ? 'Hide' : 'Show'} the {suggestion.retrieved.length} similar past NCR{suggestion.retrieved.length > 1 ? 's' : ''} used
              </button>
              {showSources && (
                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {suggestion.retrieved.map((r) => (
                    <div key={r.ncr_id} className="qms-ai-source">
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <span className="font-medium text-primary">{r.ncr_number ?? `NCR-${r.ncr_id}`}</span>
                        <span className="text-muted" style={{ fontSize: 12 }}>
                          {Math.round(r.similarity * 100)}% match{r.grade_name ? ` · ${r.grade_name}` : ''}
                        </span>
                      </div>
                      {r.root_cause && <div style={{ fontSize: 13, marginTop: 2 }}>{r.root_cause}</div>}
                      {r.corrective_actions.length > 0 && (
                        <div className="text-muted" style={{ fontSize: 12, marginTop: 2 }}>
                          Fixed by: {r.corrective_actions.join('; ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {isQE && !isClosed && (suggestion.root_cause_text || suggestion.corrective_actions.length > 0) && (
            <div>
              <Button size="sm" variant="primary" disabled={busy} onClick={apply}>
                Apply to this NCR
              </Button>
              <span className="text-muted" style={{ fontSize: 12, marginLeft: 10 }}>
                Copies the root cause and adds the actions — you can edit them after.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
