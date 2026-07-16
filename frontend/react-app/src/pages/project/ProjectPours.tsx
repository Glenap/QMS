import React from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { ErrorBox } from '../../components/ui/ErrorBox';
import { useProject } from '../../components/layout/ProjectLayout';
import { getApiErrorMessage } from '../../api/client';
import { usePours } from '../../queries/pours';
import type { PourStatus } from '../../types/master';

const STATUS_VARIANT: Record<PourStatus, 'pass' | 'warn' | 'info' | 'default'> = {
  PLANNED: 'info', IN_PROGRESS: 'warn', COMPLETED: 'pass', CANCELLED: 'default',
};
const STATUS_LABEL: Record<PourStatus, string> = {
  PLANNED: 'Planned', IN_PROGRESS: 'In progress', COMPLETED: 'Completed', CANCELLED: 'Cancelled',
};

const fmtDate = (iso: string | null): string => (iso ? new Date(iso).toLocaleDateString() : '—');

export const ProjectPours: React.FC = () => {
  const { project } = useProject();
  const pid = project.project_id;

  const { data: rows = [], isPending, error: loadError } = usePours(pid);

  return (
    <div>
      {loadError && <ErrorBox>{getApiErrorMessage(loadError, 'Unable to load pours.')}</ErrorBox>}

      <Card className="qms-form-section" padding="none">
        <div className="qms-table-container">
          <table className="qms-table">
            <thead>
              <tr><th>Reference</th><th>Location</th><th>Grade</th><th>Supplier</th><th>Date</th><th>Volume</th><th>Status</th></tr>
            </thead>
            <tbody>
              {isPending ? (
                <tr><td colSpan={7} className="text-muted">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="text-muted">No pours yet.</td></tr>
              ) : (
                rows.map((p) => (
                  <tr key={p.pour_id}>
                    <td className="font-medium">{p.pour_reference ?? `PC-${p.pour_id}`}</td>
                    <td>{[p.tower_name, p.floor_label, p.component_type].filter(Boolean).join(' · ') || '—'}</td>
                    <td>{p.grade_name ?? '—'}</td>
                    <td>{p.supplier_name ?? '—'}</td>
                    <td>{fmtDate(p.pour_date)}</td>
                    <td>{p.volume_cum != null ? `${p.volume_cum} m³` : '—'}</td>
                    <td><Badge variant={STATUS_VARIANT[p.status]}>{STATUS_LABEL[p.status]}</Badge></td>
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
