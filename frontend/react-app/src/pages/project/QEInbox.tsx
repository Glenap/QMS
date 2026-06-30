// QE inbox — deliveries the supervisor admitted that are awaiting the QE's
// in-situ slump-cone sign-off (PENDING_QE). The QE records the measured slump and
// either accepts (slump must be within the mix design range) or rejects the load.
// Supervisor-flagged mismatches show their reason + message here too.

import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ClipboardCheck, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ErrorBox } from '../../components/ui/ErrorBox';
import { useProject } from '../../components/layout/ProjectLayout';
import { useAuth } from '../../hooks/useAuth';
import { getApiErrorMessage } from '../../api/client';
import { toast } from '../../lib/toast';
import { useQEInbox, useRecordInsitu } from '../../queries/qeInbox';
import type { ActionReason, QEReviewItem } from '../../types/master';

const REASON_LABEL: Record<ActionReason, string> = {
  GRADE_MISMATCH: 'Grade mismatch',
  SLUMP_MISMATCH: 'Slump mismatch',
  VOLUME_MISMATCH: 'Volume mismatch',
  OTHER: 'Other',
};

const InsituReviewCard: React.FC<{ pid: number; item: QEReviewItem }> = ({ pid, item }) => {
  const record = useRecordInsitu(pid);
  const [slump, setSlump] = useState('');
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const act = async (decision: 'APPROVED' | 'REJECTED') => {
    if (!slump.trim()) {
      toast.error('Enter the measured slump first.');
      return;
    }
    if (decision === 'REJECTED' && !rejecting) {
      setRejecting(true);
      return;
    }
    if (decision === 'REJECTED' && !reason.trim()) return;
    try {
      const res = await record.mutateAsync({
        dispatchId: item.dispatch_id,
        data: {
          measured_slump_mm: Number(slump),
          decision,
          rejection_reason: decision === 'REJECTED' ? reason.trim() : null,
          notes: notes.trim() || null,
        },
      });
      toast.success(
        res.truck.status === 'ACCEPTED'
          ? 'Delivery accepted — credited to the pour.'
          : 'Delivery rejected — the supplier has been notified.',
      );
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not record the in-situ test.'));
    }
  };

  return (
    <Card className="qms-form-section">
      <div className="qms-detail-title-row">
        <span className="font-medium">
          {item.grade_name ?? '—'} · {item.supplier_name ?? '—'}
          {item.pour_reference ? <span className="text-muted qms-text-sm"> · {item.pour_reference}</span> : null}
        </span>
        <Badge variant="warn">Awaiting QE</Badge>
      </div>

      {item.action_item && (
        <div className="qms-alert-box" style={{ marginBottom: 10 }}>
          <AlertTriangle size={18} />
          <div>
            <strong>{REASON_LABEL[item.action_item.reason]}</strong>
            <div>{item.action_item.message}</div>
          </div>
        </div>
      )}

      <div className="qms-text-sm text-muted qms-detail-meta" style={{ marginBottom: 10 }}>
        {item.volume_cum != null && <span>Volume: {item.volume_cum} m³</span>}
        {item.target_slump_mm && <span>Target slump: {item.target_slump_mm} mm</span>}
        {item.slump_at_site_mm != null && <span>Slump at site: {item.slump_at_site_mm} mm</span>}
      </div>

      <div className="qms-grid-2">
        <Input
          label="Measured slump (mm)"
          type="number"
          step="1"
          value={slump}
          onChange={(e) => setSlump(e.target.value)}
        />
        {rejecting ? (
          <Input
            label="Rejection reason"
            placeholder="Why is this load rejected?"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        ) : (
          <Input label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        )}
      </div>

      <div className="qms-form-actions" style={{ marginTop: 12 }}>
        <Button
          variant="outline"
          icon={<XCircle size={16} />}
          disabled={record.isPending}
          onClick={() => act('REJECTED')}
        >
          {rejecting ? 'Confirm reject' : 'Reject'}
        </Button>
        <Button
          variant="primary"
          icon={<CheckCircle size={16} />}
          disabled={record.isPending}
          onClick={() => act('APPROVED')}
        >
          Pass &amp; accept
        </Button>
      </div>
    </Card>
  );
};

export const QEInbox: React.FC = () => {
  const { project } = useProject();
  const { user } = useAuth();
  const pid = project.project_id;
  const isQE = user?.role === 'QUALITY_ENGINEER';

  const { data: items = [], isPending, error } = useQEInbox(pid, isQE);

  if (user && !isQE) {
    return <Navigate to={`/app/projects/${pid}`} replace />;
  }

  return (
    <div>
      <div className="qms-pw-header">
        <h1 className="qms-pw-title">
          <ClipboardCheck size={20} /> In-situ sign-off inbox
        </h1>
        <p className="text-muted">
          Run the in-situ slump test on each admitted delivery, then accept or reject it.
        </p>
      </div>

      {error && <ErrorBox>{getApiErrorMessage(error, 'Unable to load the inbox.')}</ErrorBox>}

      {isPending ? (
        <p className="text-muted qms-text-sm">Loading…</p>
      ) : items.length === 0 ? (
        <Card className="qms-form-section">
          <p className="text-muted qms-text-sm">No deliveries are awaiting your sign-off.</p>
        </Card>
      ) : (
        items.map((item) => <InsituReviewCard key={item.dispatch_id} pid={pid} item={item} />)
      )}
    </div>
  );
};
