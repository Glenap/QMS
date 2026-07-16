import React from 'react';
import { ChevronDown, ChevronRight, FlaskConical } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import type { NCRResponse } from '../../types/master';
import { NCRDetailPanel } from './NCRDetailPanel';
import { fmtDate, issueText, ncrLocation, severityBadge, STATUS_BADGE } from './ncrFormat';

interface NCRListProps {
  rows: NCRResponse[];
  loading: boolean;
  expandedId: number | null;
  onToggle: (ncrId: number) => void;
  pid: number;
  isQE: boolean;
}

export const NCRList: React.FC<NCRListProps> = ({
  rows, loading, expandedId, onToggle, pid, isQE,
}) => (
  <Card padding="none" className="qms-ncr-list-card">
    <div className="qms-table-container">
      <table className="qms-table">
        <thead>
          <tr>
            <th style={{ width: 32 }}><span className="qms-sr-only">Expand</span></th>
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
              const label = n.ncr_number ?? `NCR-${n.ncr_id}`;
              const detailId = `ncr-detail-${n.ncr_id}`;
              return (
                <React.Fragment key={n.ncr_id}>
                  <tr className="qms-ncr-row" onClick={() => onToggle(n.ncr_id)}>
                    <td>
                      <button
                        type="button"
                        className="qms-ncr-expand-btn"
                        aria-expanded={open}
                        aria-controls={detailId}
                        aria-label={`${open ? 'Collapse' : 'Expand'} ${label}`}
                        onClick={(e) => { e.stopPropagation(); onToggle(n.ncr_id); }}
                      >
                        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                    </td>
                    <td className="font-medium text-primary">{label}</td>
                    <td className="font-medium">{issueText(n)}</td>
                    <td>{ncrLocation(n)}</td>
                    <td>{severityBadge(n.result_status)}</td>
                    <td>
                      {n.corrective_action_count === 0
                        ? <span className="text-muted">—</span>
                        : <span>{n.corrective_action_count - n.open_action_count}/{n.corrective_action_count} done</span>}
                      {n.retest_count > 0 && (
                        <span className="text-muted qms-ncr-retest-tag" title="Retests ordered">
                          <FlaskConical size={12} /> {n.retest_count}
                        </span>
                      )}
                    </td>
                    <td><Badge variant={s.variant} icon={s.icon}>{s.label}</Badge></td>
                    <td>{fmtDate(n.raised_at)}</td>
                  </tr>
                  {open && (
                    <tr id={detailId}>
                      <td colSpan={8} className="qms-ncr-detail-cell">
                        <NCRDetailPanel pid={pid} ncrId={n.ncr_id} isQE={isQE} />
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
);
