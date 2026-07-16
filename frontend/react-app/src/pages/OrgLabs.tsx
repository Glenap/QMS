// Org-wide testing-lab directory — every lab across the organisation's projects,
// with the project + contractor each is registered under. Read-only.

import React from 'react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { ErrorBox } from '../components/ui/ErrorBox';
import { getApiErrorMessage } from '../api/client';
import { useOrgLabs } from '../queries/directory';
import type { LabDirectoryItem } from '../types/master';

const LAB_TYPE_LABEL: Record<string, string> = {
  IN_HOUSE: 'In-house',
  THIRD_PARTY: 'Third-party',
};

const statusBadge = (item: LabDirectoryItem) => {
  if (item.is_blocked) return { variant: 'fail' as const, label: 'Blocked' };
  if (item.approval_status === 'PENDING') return { variant: 'warn' as const, label: 'Awaiting approval' };
  if (item.approval_status === 'REJECTED') return { variant: 'fail' as const, label: 'Rejected' };
  if (item.status === 'CONFIRMED') return { variant: 'pass' as const, label: 'Confirmed' };
  if (item.status === 'DECLINED') return { variant: 'fail' as const, label: 'Declined' };
  return { variant: 'pending' as const, label: 'Pending' };
};

export const OrgLabs: React.FC = () => {
  const { data: rows = [], isPending, error } = useOrgLabs();

  return (
    <div className="qms-page">
      <div className="qms-page-header-block">
        <div>
          <h2 className="qms-section-heading-plain">Laboratories</h2>
          <p className="qms-page-subtitle">
            Every testing lab across your projects — which project and contractor each is assigned to.
          </p>
        </div>
      </div>

      {error && <ErrorBox>{getApiErrorMessage(error, 'Unable to load laboratories.')}</ErrorBox>}

      <Card className="qms-form-section" padding="none">
        <div className="qms-table-container">
          <table className="qms-table">
            <thead>
              <tr><th>Laboratory</th><th>Type</th><th>Project</th><th>Contractor</th><th>Contact</th><th>Status</th></tr>
            </thead>
            <tbody>
              {isPending ? (
                <tr><td colSpan={6} className="text-muted">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="text-muted">No testing labs registered yet.</td></tr>
              ) : (
                rows.map((l) => {
                  const st = statusBadge(l);
                  return (
                    <tr key={l.lab_id}>
                      <td className="font-medium">
                        {l.lab_name}
                        {l.city && <span className="qms-text-sm text-muted"> · {l.city}</span>}
                      </td>
                      <td className="qms-text-sm">{LAB_TYPE_LABEL[l.lab_type] ?? l.lab_type}</td>
                      <td>{l.project_name ?? '—'}</td>
                      <td>{l.contractor_org_name ?? '—'}</td>
                      <td className="qms-text-sm">{l.contact_email ?? '—'}</td>
                      <td><Badge variant={st.variant}>{st.label}</Badge></td>
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
