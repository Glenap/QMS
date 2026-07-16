// Org-wide RMC directory — every supplier across the organisation's projects,
// with the project + contractor each is registered under. Read-only; registration
// / approval / block live on the per-project Suppliers pages.

import React from 'react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { ErrorBox } from '../components/ui/ErrorBox';
import { getApiErrorMessage } from '../api/client';
import { useOrgSuppliers } from '../queries/directory';
import type { SupplierDirectoryItem } from '../types/master';

const statusBadge = (item: SupplierDirectoryItem) => {
  if (item.is_blocked) return { variant: 'fail' as const, label: 'Blocked' };
  if (item.approval_status === 'PENDING') return { variant: 'warn' as const, label: 'Awaiting approval' };
  if (item.approval_status === 'REJECTED') return { variant: 'fail' as const, label: 'Rejected' };
  if (item.status === 'CONFIRMED') return { variant: 'pass' as const, label: 'Confirmed' };
  if (item.status === 'DECLINED') return { variant: 'fail' as const, label: 'Declined' };
  return { variant: 'pending' as const, label: 'Pending' };
};

export const OrgSuppliers: React.FC = () => {
  const { data: rows = [], isPending, error } = useOrgSuppliers();

  return (
    <div className="qms-page">
      <div className="qms-page-header-block">
        <div>
          <h2 className="qms-section-heading-plain">RMC Suppliers</h2>
          <p className="qms-page-subtitle">
            Every RMC across your projects — which project and contractor each is assigned to.
          </p>
        </div>
      </div>

      {error && <ErrorBox>{getApiErrorMessage(error, 'Unable to load suppliers.')}</ErrorBox>}

      <Card className="qms-form-section" padding="none">
        <div className="qms-table-container">
          <table className="qms-table">
            <thead>
              <tr><th>RMC</th><th>Project</th><th>Contractor</th><th>Contact</th><th>Status</th></tr>
            </thead>
            <tbody>
              {isPending ? (
                <tr><td colSpan={5} className="text-muted">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="text-muted">No RMC suppliers registered yet.</td></tr>
              ) : (
                rows.map((s) => {
                  const st = statusBadge(s);
                  return (
                    <tr key={s.supplier_id}>
                      <td className="font-medium">
                        {s.supplier_name}
                        {s.plant_location && <span className="qms-text-sm text-muted"> · {s.plant_location}</span>}
                      </td>
                      <td>{s.project_name ?? '—'}</td>
                      <td>{s.contractor_org_name ?? '—'}</td>
                      <td className="qms-text-sm">{s.contact_email ?? '—'}</td>
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
