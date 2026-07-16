// One RMC supplier's detail: header, the contractor's mix-design grade requests
// (+ the RMC's tokenised submission link), and the submitted mix designs the QE
// reviews. Reached from a contractor's Suppliers tab or the Suppliers table.

import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Copy, Check } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ErrorBox } from '../../components/ui/ErrorBox';
import { MixDesignsPanel } from '../../components/mix/MixDesignsPanel';
import { useProject } from '../../components/layout/ProjectLayout';
import { getApiErrorMessage } from '../../api/client';
import { toast } from '../../lib/toast';
import { useSuppliers } from '../../queries/suppliers';
import { useGrades } from '../../queries/catalog';
import {
  useRequiredGrades,
  useSetRequiredGrades,
  useSupplierMixDesigns,
} from '../../queries/mixDesigns';
import type { ConfirmationStatus } from '../../types/master';
import './Detail.css';

const CONF_VARIANT: Record<ConfirmationStatus, 'pass' | 'warn' | 'fail'> = {
  CONFIRMED: 'pass', PENDING: 'warn', DECLINED: 'fail',
};
const CONF_LABEL: Record<ConfirmationStatus, string> = {
  CONFIRMED: 'Confirmed', PENDING: 'Pending', DECLINED: 'Declined',
};

export const SupplierDetail: React.FC = () => {
  const { project } = useProject();
  const navigate = useNavigate();
  const pid = project.project_id;
  const { supplierId } = useParams();
  const sid = Number(supplierId);
  const canManage = project.access.can_manage_contractor_side;
  const isQE = project.access.project_role === 'QUALITY_ENGINEER';

  const suppliersQuery = useSuppliers(pid);
  const designsQuery = useSupplierMixDesigns(pid, sid);
  const requiredQuery = useRequiredGrades(pid, sid);
  const { data: grades = [] } = useGrades();
  const setRequired = useSetRequiredGrades(pid, sid);

  const [copied, setCopied] = useState(false);

  const loading = suppliersQuery.isPending || designsQuery.isPending;
  const loadError = suppliersQuery.error ?? designsQuery.error;
  const supplier = (suppliersQuery.data ?? []).find((s) => s.supplier_id === sid) ?? null;
  const designs = designsQuery.data ?? [];
  const requiredIds = new Set((requiredQuery.data ?? []).map((g) => g.grade_id));

  const submissionLink = supplier?.mix_submission_token
    ? `${window.location.origin}/external/mix-design?token=${supplier.mix_submission_token}`
    : null;

  const toggleGrade = async (gradeId: number) => {
    const next = new Set(requiredIds);
    if (next.has(gradeId)) next.delete(gradeId);
    else next.add(gradeId);
    try {
      await setRequired.mutateAsync([...next]);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not update requested grades.'));
    }
  };

  const copyLink = async () => {
    if (!submissionLink) return;
    try {
      await navigator.clipboard.writeText(submissionLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy the link.');
    }
  };

  const backTo = supplier
    ? `/app/projects/${pid}/contractors/${supplier.contractor_org_id}`
    : `/app/projects/${pid}/suppliers`;

  return (
    <div>
      <button type="button" className="qms-pw-back" onClick={() => navigate(backTo)}>
        <ChevronLeft size={16} /> {supplier?.contractor_org_name ?? 'Suppliers'}
      </button>

      {loadError && <ErrorBox>{getApiErrorMessage(loadError, 'Unable to load this supplier.')}</ErrorBox>}

      {loading ? (
        <p className="text-muted qms-text-sm">Loading…</p>
      ) : !supplier ? (
        <p className="text-muted qms-text-sm">Supplier not found.</p>
      ) : (
        <>
          <Card className="qms-form-section">
            <div className="qms-detail-title-row">
              <h2 className="qms-pw-title">{supplier.supplier_name}</h2>
              {supplier.is_blocked
                ? <Badge variant="fail" title={supplier.block_reason ?? undefined}>Blocked</Badge>
                : <Badge variant={CONF_VARIANT[supplier.status]}>{CONF_LABEL[supplier.status]}</Badge>}
            </div>
            {supplier.is_blocked && supplier.block_reason && (
              <p className="qms-text-sm" style={{ color: '#991B1B' }}>Blocked: {supplier.block_reason}</p>
            )}
            <div className="qms-text-sm text-muted qms-detail-meta">
              {supplier.plant_name && <span>Plant: {supplier.plant_name}</span>}
              {supplier.plant_location && <span>Location: {supplier.plant_location}</span>}
              {supplier.plant_distance_km != null && <span>{supplier.plant_distance_km} km from site</span>}
              {(supplier.contact_email || supplier.contact_phone) && (
                <span>Contact: {supplier.contact_email ?? supplier.contact_phone}</span>
              )}
            </div>
          </Card>

          {canManage && (
            <Card className="qms-form-section">
              <h3 className="qms-section-heading-plain qms-mb-12">Mix designs requested</h3>
              <p className="text-muted qms-text-sm qms-mb-12">
                Pick the grades this plant must submit a mix design for. They get a
                link to submit one per grade; the quality engineer approves each.
              </p>
              <div className="qms-mix-grade-picker">
                {grades.map((g) => (
                  <label key={g.grade_id} className="qms-mix-grade-chip">
                    <input
                      type="checkbox"
                      checked={requiredIds.has(g.grade_id)}
                      disabled={setRequired.isPending}
                      onChange={() => toggleGrade(g.grade_id)}
                    />
                    {g.grade_name}
                  </label>
                ))}
              </div>
              {submissionLink && (
                <div className="qms-mix-link-row">
                  <input className="qms-mix-link-input" readOnly value={submissionLink} />
                  <Button
                    size="sm"
                    variant="outline"
                    icon={copied ? <Check size={14} /> : <Copy size={14} />}
                    onClick={copyLink}
                  >
                    {copied ? 'Copied' : 'Copy link'}
                  </Button>
                </div>
              )}
            </Card>
          )}

          <Card className="qms-form-section" padding="none">
            <div className="qms-p-4 qms-border-b">
              <h3 className="qms-section-heading-plain">Submitted mix designs</h3>
            </div>
            <div className="qms-p-4">
              <MixDesignsPanel
                pid={pid}
                designs={designs}
                canReview={isQE}
                showSupplier={false}
                emptyText="This plant hasn't submitted any mix designs yet."
              />
            </div>
          </Card>
        </>
      )}
    </div>
  );
};
