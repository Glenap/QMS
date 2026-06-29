import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, CheckCircle2 } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { ErrorBox } from '../../components/ui/ErrorBox';
import { useProject } from '../../components/layout/ProjectLayout';
import { useAuth } from '../../hooks/useAuth';
import { getApiErrorMessage } from '../../api/client';
import { toast } from '../../lib/toast';
import { useCompletePour, usePours } from '../../queries/pours';
import type { PourResponse, PourStatus } from '../../types/master';

const STATUS_VARIANT: Record<PourStatus, 'pass' | 'warn' | 'info' | 'default'> = {
  PLANNED: 'info', IN_PROGRESS: 'warn', COMPLETED: 'pass', CANCELLED: 'default',
};
const STATUS_LABEL: Record<PourStatus, string> = {
  PLANNED: 'Planned', IN_PROGRESS: 'In progress', COMPLETED: 'Completed', CANCELLED: 'Cancelled',
};

const fmtDate = (iso: string | null): string => (iso ? new Date(iso).toLocaleDateString() : '—');

export const ProjectPours: React.FC = () => {
  const { project } = useProject();
  const { user } = useAuth();
  const navigate = useNavigate();
  const pid = project.project_id;
  const isQE = user?.role === 'QUALITY_ENGINEER';

  const { data: rows = [], isPending, error: loadError } = usePours(pid);
  const complete = useCompletePour(pid);

  const handleComplete = async (p: PourResponse) => {
    try {
      await complete.mutateAsync(p.pour_id);
      toast.success(`Pour ${p.pour_reference ?? `PC-${p.pour_id}`} marked complete.`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Unable to complete pour.'));
    }
  };

  return (
    <div>
      <div className="qms-page-header-block">
        <div>
          <h2 className="qms-section-heading-plain">Pour cards</h2>
          <p className="qms-page-subtitle">Planned and completed concrete pours for this project</p>
        </div>
        {isQE && (
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => navigate(`/app/projects/${pid}/pours/new`)}>
            New pour
          </Button>
        )}
      </div>

      {loadError && <ErrorBox>{getApiErrorMessage(loadError, 'Unable to load pours.')}</ErrorBox>}

      <Card className="qms-form-section" padding="none">
        <div className="qms-table-container">
          <table className="qms-table">
            <thead>
              <tr><th>Reference</th><th>Location</th><th>Grade</th><th>Supplier</th><th>Date</th><th>Volume</th><th>Status</th>{isQE && <th></th>}</tr>
            </thead>
            <tbody>
              {isPending ? (
                <tr><td colSpan={isQE ? 8 : 7} className="text-muted">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={isQE ? 8 : 7} className="text-muted">No pours yet.</td></tr>
              ) : (
                rows.map((p) => (
                  <tr key={p.pour_id}>
                    <td className="font-medium">{p.pour_reference ?? `PC-${p.pour_id}`}</td>
                    <td>{[p.tower_name, p.floor_label, p.component_type].filter(Boolean).join(' · ') || '—'}</td>
                    <td>{p.grade_name ?? '—'}</td>
                    <td>{p.supplier_name ?? '—'}</td>
                    <td>{fmtDate(p.pour_date)}</td>
                    <td>
                      {p.volume_cum != null ? (
                        <>
                          {(p.volume_delivered_cum ?? 0) > 0 && (
                            <span className="font-medium">{p.volume_delivered_cum} / </span>
                          )}
                          {p.volume_cum} m³
                          {p.status !== 'COMPLETED' && (p.volume_remaining_cum ?? 0) > 0 && (p.volume_delivered_cum ?? 0) > 0 && (
                            <span className="qms-text-sm text-muted"> · {p.volume_remaining_cum} left</span>
                          )}
                        </>
                      ) : '—'}
                    </td>
                    <td><Badge variant={STATUS_VARIANT[p.status]}>{STATUS_LABEL[p.status]}</Badge></td>
                    {isQE && (
                      <td>
                        {p.status !== 'COMPLETED' && p.status !== 'CANCELLED' && (
                          <Button variant="ghost" size="sm" icon={<CheckCircle2 size={14} />}
                            disabled={complete.isPending && complete.variables === p.pour_id}
                            onClick={() => handleComplete(p)}>
                            {complete.isPending && complete.variables === p.pour_id ? 'Saving…' : 'Complete'}
                          </Button>
                        )}
                      </td>
                    )}
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
