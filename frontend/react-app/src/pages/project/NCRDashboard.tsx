import React, { useCallback, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { useProject } from '../../components/layout/ProjectLayout';
import { getApiErrorMessage } from '../../api/client';
import { ErrorBox } from '../../components/ui/ErrorBox';
import { NCRList } from '../../components/ncr/NCRList';
import { useNcrList } from '../../components/ncr/queries';
import '../../components/ncr/ncr.css';

export const NCRDashboard: React.FC = () => {
  const { project } = useProject();
  const pid = project.project_id;
  const isQE = project.access.project_role === 'QUALITY_ENGINEER';

  const { data, isPending, error } = useNcrList(pid);
  const rows = useMemo(() => data ?? [], [data]);

  const [expandedId, setExpandedId] = useState<number | null>(null);

  const counts = useMemo(() => ({
    open: rows.filter((n) => n.status !== 'CLOSED').length,
    critical: rows.filter((n) => n.result_status === 'CRITICAL_FAILURE').length,
    closed: rows.filter((n) => n.status === 'CLOSED').length,
  }), [rows]);

  const toggle = useCallback((ncrId: number) => {
    setExpandedId((cur) => (cur === ncrId ? null : ncrId));
  }, []);

  return (
    <div className="qms-page">
      {error && <ErrorBox>{getApiErrorMessage(error, 'Unable to load NCRs.')}</ErrorBox>}

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

      <NCRList
        rows={rows}
        loading={isPending}
        expandedId={expandedId}
        onToggle={toggle}
        pid={pid}
        isQE={!!isQE}
      />
    </div>
  );
};
