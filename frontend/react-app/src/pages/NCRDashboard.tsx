import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { useProject } from '../components/layout/ProjectLayout';
import { cubeTestsApi } from '../api/cubeTests';
import { getApiErrorMessage } from '../api/client';
import type { NCRResponse, NCRStatus, ResultStatus } from '../types/master';
import './NCRDashboard.css';

const STATUS_BADGE: Record<NCRStatus, { variant: 'pass' | 'warn' | 'pending'; label: string; icon?: React.ReactNode }> = {
  OPEN: { variant: 'pending', label: 'Open' },
  UNDER_REVIEW: { variant: 'warn', label: 'Under review', icon: <Clock size={12} /> },
  CLOSED: { variant: 'pass', label: 'Closed', icon: <CheckCircle size={12} /> },
};

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

export const NCRDashboard: React.FC = () => {
  const { project } = useProject();
  const pid = project.project_id;

  const [rows, setRows] = useState<NCRResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await cubeTestsApi.listNcrs(pid));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to load NCRs.'));
    } finally {
      setLoading(false);
    }
  }, [pid]);

  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => ({
    open: rows.filter((n) => n.status === 'OPEN').length,
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
          </p>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 14, background: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5' }}>
          {error}
        </div>
      )}

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
                <th>NCR</th>
                <th>Issue</th>
                <th>Location</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Raised</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-muted">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="text-muted">No NCRs — every cube test has passed so far.</td></tr>
              ) : (
                rows.map((n) => {
                  const s = STATUS_BADGE[n.status];
                  return (
                    <tr key={n.ncr_id}>
                      <td className="font-medium text-primary">{n.ncr_number ?? `NCR-${n.ncr_id}`}</td>
                      <td className="font-medium">{issueText(n)}</td>
                      <td>{location(n)}</td>
                      <td>{severityBadge(n.result_status)}</td>
                      <td><Badge variant={s.variant} icon={s.icon}>{s.label}</Badge></td>
                      <td>{fmtDate(n.raised_at)}</td>
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
