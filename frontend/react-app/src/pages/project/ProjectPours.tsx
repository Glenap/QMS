import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, CheckCircle2 } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useProject } from '../../components/layout/ProjectLayout';
import { useAuth } from '../../hooks/useAuth';
import { poursApi } from '../../api/pours';
import { getApiErrorMessage } from '../../api/client';
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

  const [rows, setRows] = useState<PourResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [completingId, setCompletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await poursApi.list(pid));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to load pours.'));
    } finally {
      setLoading(false);
    }
  }, [pid]);

  useEffect(() => { void load(); }, [load]);

  const handleComplete = async (p: PourResponse) => {
    setError(null); setCompletingId(p.pour_id);
    try {
      await poursApi.complete(pid, p.pour_id, {});
      void load();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to complete pour.'));
    } finally {
      setCompletingId(null);
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

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 14, background: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5' }}>
          {error}
        </div>
      )}

      <Card className="qms-form-section" padding="none">
        <div className="qms-table-container">
          <table className="qms-table">
            <thead>
              <tr><th>Reference</th><th>Location</th><th>Grade</th><th>Supplier</th><th>Date</th><th>Volume</th><th>Status</th>{isQE && <th></th>}</tr>
            </thead>
            <tbody>
              {loading ? (
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
                    <td>{p.volume_cum != null ? `${p.volume_cum} m³` : '—'}</td>
                    <td><Badge variant={STATUS_VARIANT[p.status]}>{STATUS_LABEL[p.status]}</Badge></td>
                    {isQE && (
                      <td>
                        {p.status !== 'COMPLETED' && p.status !== 'CANCELLED' && (
                          <Button variant="ghost" size="sm" icon={<CheckCircle2 size={14} />} disabled={completingId === p.pour_id} onClick={() => handleComplete(p)}>
                            {completingId === p.pour_id ? 'Saving…' : 'Complete'}
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
