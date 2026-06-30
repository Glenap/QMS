// Shared mix-design list with optional QE review controls. Used by the global
// ProjectMixDesigns page and the per-supplier SupplierDetail section.
//
// Mix designs are RMC-owned: the RMC submits the detailed form, the QE reviews
// (Approve / Reject-with-reason / In progress) and records the observed 28-day
// strength. Only an APPROVED mix's grade may be poured.

import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { toast } from '../../lib/toast';
import { getApiErrorMessage } from '../../api/client';
import { useReviewMixDesign } from '../../queries/mixDesigns';
import type { MixApprovalStatus, MixDesignResponse } from '../../types/master';
import './MixDesignsPanel.css';

const VARIANT: Record<MixApprovalStatus, 'pass' | 'fail' | 'warn' | 'pending'> = {
  APPROVED: 'pass', REJECTED: 'fail', IN_PROGRESS: 'warn', PENDING: 'pending',
};
const LABEL: Record<MixApprovalStatus, string> = {
  APPROVED: 'Approved', REJECTED: 'Rejected', IN_PROGRESS: 'In progress', PENDING: 'Pending review',
};

const spec = (label: string, value: React.ReactNode) =>
  value == null || value === '' ? null : (
    <div className="qms-mix-spec">
      <span className="text-muted">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );

const ReviewControls: React.FC<{ pid: number; mix: MixDesignResponse }> = ({ pid, mix }) => {
  const review = useReviewMixDesign(pid);
  const [observed, setObserved] = useState(
    mix.observed_28day_strength_mpa != null ? String(mix.observed_28day_strength_mpa) : '',
  );
  const [reason, setReason] = useState(mix.rejection_reason ?? '');
  const [rejecting, setRejecting] = useState(false);

  const act = async (status: 'APPROVED' | 'IN_PROGRESS' | 'REJECTED') => {
    if (status === 'REJECTED' && !rejecting) {
      setRejecting(true);
      return;
    }
    if (status === 'REJECTED' && !reason.trim()) return;
    try {
      await review.mutateAsync({
        id: mix.mix_design_id,
        data: {
          approval_status: status,
          rejection_reason: status === 'REJECTED' ? reason.trim() : null,
          observed_28day_strength_mpa: observed.trim() ? Number(observed) : null,
        },
      });
      toast.success(`Mix design ${LABEL[status as MixApprovalStatus].toLowerCase()}.`);
      setRejecting(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not update the mix design.'));
    }
  };

  return (
    <div className="qms-mix-review">
      <div className="qms-grid-2">
        <Input
          label="Observed 28-day strength (MPa)"
          type="number"
          step="0.1"
          placeholder="optional"
          value={observed}
          onChange={(e) => setObserved(e.target.value)}
        />
        {rejecting && (
          <Input
            label="Rejection reason"
            placeholder="Why is this mix rejected?"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        )}
      </div>
      <div className="qms-form-actions">
        <Button size="sm" variant="primary" disabled={review.isPending} onClick={() => act('APPROVED')}>
          Approve
        </Button>
        <Button size="sm" variant="outline" disabled={review.isPending} onClick={() => act('IN_PROGRESS')}>
          In progress
        </Button>
        <Button size="sm" variant="outline" disabled={review.isPending} onClick={() => act('REJECTED')}>
          {rejecting ? 'Confirm reject' : 'Reject'}
        </Button>
      </div>
    </div>
  );
};

const MixDesignCard: React.FC<{
  pid: number;
  mix: MixDesignResponse;
  canReview: boolean;
  showSupplier: boolean;
}> = ({ pid, mix, canReview, showSupplier }) => (
  <Card className="qms-mix-card">
    <div className="qms-detail-title-row">
      <span className="font-medium">
        {mix.grade_name ?? `Grade #${mix.grade_id}`}
        {showSupplier && mix.supplier_name ? ` · ${mix.supplier_name}` : ''}
        {mix.mix_design_ref ? <span className="text-muted qms-text-sm"> · {mix.mix_design_ref}</span> : null}
      </span>
      {mix.approval_status && (
        <Badge variant={VARIANT[mix.approval_status]}>{LABEL[mix.approval_status]}</Badge>
      )}
    </div>
    <div className="qms-mix-specs">
      {spec('Mix type', mix.mix_type)}
      {spec('Exposure', mix.exposure_condition)}
      {spec('Cement', mix.cement_type?.replace('_', ' '))}
      {spec('W/C ratio', mix.wc_ratio)}
      {spec('Total binder', mix.total_binder_kg != null ? `${mix.total_binder_kg} kg/m³` : null)}
      {spec('Target mean', mix.target_mean_strength_mpa != null ? `${mix.target_mean_strength_mpa} MPa` : null)}
      {spec('Max agg', mix.max_aggregate_size_mm != null ? `${mix.max_aggregate_size_mm} mm` : null)}
      {spec('Slump range', mix.slump_range_mm)}
      {spec('Observed 28-day', mix.observed_28day_strength_mpa != null ? `${mix.observed_28day_strength_mpa} MPa` : null)}
    </div>
    {mix.approval_status === 'REJECTED' && mix.rejection_reason && (
      <p className="qms-text-sm" style={{ color: '#991B1B' }}>Rejected: {mix.rejection_reason}</p>
    )}
    {canReview && mix.approval_status !== 'APPROVED' && <ReviewControls pid={pid} mix={mix} />}
  </Card>
);

export const MixDesignsPanel: React.FC<{
  pid: number;
  designs: MixDesignResponse[];
  canReview: boolean;
  showSupplier?: boolean;
  emptyText?: string;
}> = ({ pid, designs, canReview, showSupplier = true, emptyText = 'No mix designs submitted yet.' }) => {
  if (designs.length === 0) {
    return <p className="text-muted qms-text-sm">{emptyText}</p>;
  }
  return (
    <div className="qms-mix-list">
      {designs.map((m) => (
        <MixDesignCard
          key={m.mix_design_id}
          pid={pid}
          mix={m}
          canReview={canReview}
          showSupplier={showSupplier}
        />
      ))}
    </div>
  );
};
