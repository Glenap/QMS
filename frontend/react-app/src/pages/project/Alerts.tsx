// IS-456/10262 quality alert feed for the QE + project manager. Each alert can be
// acknowledged, and — when it's tied to an RMC supplier — the QE/PM can email that
// supplier about the issue right from the alert.

import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Bell, CheckCircle, Mail, AlertTriangle } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ErrorBox } from '../../components/ui/ErrorBox';
import { useProject } from '../../components/layout/ProjectLayout';
import { useAuth } from '../../hooks/useAuth';
import { getApiErrorMessage } from '../../api/client';
import { toast } from '../../lib/toast';
import { useAcknowledgeAlert, useAlerts, useNotifyRmc } from '../../queries/alerts';
import type { AlertLevel, AlertResponse } from '../../types/master';

const LEVEL_VARIANT: Record<AlertLevel, 'fail' | 'warn' | 'info'> = {
  CRITICAL: 'fail', WARNING: 'warn', INFO: 'info',
};

const AlertCard: React.FC<{ pid: number; alert: AlertResponse }> = ({ pid, alert }) => {
  const ack = useAcknowledgeAlert(pid);
  const notify = useNotifyRmc(pid);
  const [composing, setComposing] = useState(false);
  const [subject, setSubject] = useState(alert.title);
  const [message, setMessage] = useState(alert.message);

  const sendRmc = async () => {
    if (!alert.supplier_id || !subject.trim() || !message.trim()) return;
    try {
      await notify.mutateAsync({ supplierId: alert.supplier_id, data: { subject: subject.trim(), message: message.trim() } });
      toast.success(`Issue emailed to ${alert.supplier_name ?? 'the RMC'}.`);
      setComposing(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not email the RMC.'));
    }
  };

  return (
    <Card className="qms-form-section">
      <div className="qms-detail-title-row">
        <span className="font-medium" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={16} /> {alert.title}
        </span>
        <Badge variant={LEVEL_VARIANT[alert.level]}>{alert.level}</Badge>
      </div>
      <p className="qms-text-sm" style={{ margin: '6px 0' }}>{alert.message}</p>
      <div className="qms-text-sm text-muted qms-detail-meta" style={{ marginBottom: 10 }}>
        {alert.supplier_name && <span>RMC: {alert.supplier_name}</span>}
        <span>{new Date(alert.created_at).toLocaleString()}</span>
      </div>

      {composing ? (
        <div>
          <Input label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <label className="qms-input-label" style={{ display: 'block', marginTop: 8 }}>
            Message
            <textarea className="qms-mix-link-input" style={{ width: '100%', minHeight: 90, marginTop: 4 }}
              value={message} onChange={(e) => setMessage(e.target.value)} />
          </label>
          <div className="qms-form-actions" style={{ marginTop: 10 }}>
            <Button variant="ghost" onClick={() => setComposing(false)}>Cancel</Button>
            <Button variant="primary" icon={<Mail size={15} />} disabled={notify.isPending || !subject.trim() || !message.trim()} onClick={sendRmc}>
              {notify.isPending ? 'Sending…' : 'Send to RMC'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="qms-form-actions">
          {alert.supplier_id && (
            <Button variant="outline" size="sm" icon={<Mail size={14} />} onClick={() => setComposing(true)}>
              Email RMC
            </Button>
          )}
          <Button variant="primary" size="sm" icon={<CheckCircle size={14} />} disabled={ack.isPending} onClick={() => ack.mutate(alert.alert_id)}>
            Acknowledge
          </Button>
        </div>
      )}
    </Card>
  );
};

export const Alerts: React.FC = () => {
  const { project } = useProject();
  const { user } = useAuth();
  const pid = project.project_id;
  const canView = user?.role === 'QUALITY_ENGINEER' || user?.role === 'PROJECT_MANAGER';

  const { data: alerts = [], isPending, error } = useAlerts(pid, canView);

  if (user && !canView) return <Navigate to={`/app/projects/${pid}`} replace />;

  return (
    <div>
      <div className="qms-pw-header">
        <h1 className="qms-pw-title"><Bell size={20} /> Quality alerts</h1>
        <p className="text-muted">IS 456 / IS 10262 strength alerts — acknowledge and notify the RMC.</p>
      </div>

      {error && <ErrorBox>{getApiErrorMessage(error, 'Unable to load alerts.')}</ErrorBox>}

      {isPending ? (
        <p className="text-muted qms-text-sm">Loading…</p>
      ) : alerts.length === 0 ? (
        <Card className="qms-form-section">
          <p className="text-muted qms-text-sm">No open alerts — strength is within IS 456 limits.</p>
        </Card>
      ) : (
        alerts.map((a) => <AlertCard key={a.alert_id} pid={pid} alert={a} />)
      )}
    </div>
  );
};
