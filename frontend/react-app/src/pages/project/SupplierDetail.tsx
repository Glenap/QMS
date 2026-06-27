// One RMC supplier's detail: header + its mix designs grouped by grade.
// Reached from a contractor's Suppliers tab or the project Suppliers table.

import React, { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { ErrorBox } from '../../components/ui/ErrorBox';
import { useProject } from '../../components/layout/ProjectLayout';
import { getApiErrorMessage } from '../../api/client';
import { useSuppliers } from '../../queries/suppliers';
import { useMixDesigns } from '../../queries/mixDesigns';
import type {
  ConfirmationStatus,
  MixApprovalStatus,
  MixDesignResponse,
} from '../../types/master';
import './Detail.css';

const CONF_VARIANT: Record<ConfirmationStatus, 'pass' | 'warn' | 'fail'> = {
  CONFIRMED: 'pass', PENDING: 'warn', DECLINED: 'fail',
};
const CONF_LABEL: Record<ConfirmationStatus, string> = {
  CONFIRMED: 'Confirmed', PENDING: 'Pending', DECLINED: 'Declined',
};
const APPROVAL_VARIANT: Record<MixApprovalStatus, 'pass' | 'fail' | 'warn'> = {
  APPROVED: 'pass', REJECTED: 'fail', IN_PROGRESS: 'warn',
};

interface GradeGroup {
  gradeId: number;
  gradeName: string;
  designs: MixDesignResponse[];
}

export const SupplierDetail: React.FC = () => {
  const { project } = useProject();
  const navigate = useNavigate();
  const pid = project.project_id;
  const { supplierId } = useParams();
  const sid = Number(supplierId);

  const suppliersQuery = useSuppliers(pid);
  const designsQuery = useMixDesigns(pid);
  const loading = suppliersQuery.isPending || designsQuery.isPending;
  const loadError = suppliersQuery.error ?? designsQuery.error;

  const supplier = (suppliersQuery.data ?? []).find((s) => s.supplier_id === sid) ?? null;
  const designs = useMemo(
    () => (designsQuery.data ?? []).filter((m) => m.supplier_id === sid),
    [designsQuery.data, sid],
  );

  // grades → mix designs: one section per grade, designs nested under it.
  const groups = useMemo<GradeGroup[]>(() => {
    const map = new Map<number, GradeGroup>();
    for (const m of designs) {
      const g = map.get(m.grade_id);
      if (g) g.designs.push(m);
      else map.set(m.grade_id, { gradeId: m.grade_id, gradeName: m.grade_name ?? `Grade #${m.grade_id}`, designs: [m] });
    }
    return [...map.values()].sort((a, b) => a.gradeName.localeCompare(b.gradeName));
  }, [designs]);

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
              <Badge variant={CONF_VARIANT[supplier.status]}>{CONF_LABEL[supplier.status]}</Badge>
            </div>
            <div className="qms-text-sm text-muted qms-detail-meta">
              {supplier.plant_name && <span>Plant: {supplier.plant_name}</span>}
              {supplier.plant_location && <span>Location: {supplier.plant_location}</span>}
              {supplier.plant_distance_km != null && <span>{supplier.plant_distance_km} km from site</span>}
              {(supplier.contact_email || supplier.contact_phone) && (
                <span>Contact: {supplier.contact_email ?? supplier.contact_phone}</span>
              )}
            </div>
          </Card>

          <Card className="qms-form-section" padding="none">
            <div className="qms-p-4 qms-border-b">
              <h3 className="qms-section-heading-plain">Mix designs by grade</h3>
            </div>
            <div className="qms-p-4 qms-detail-groups">
              {groups.length === 0 ? (
                <p className="text-muted qms-text-sm qms-detail-msg">No mix designs registered for this supplier yet.</p>
              ) : (
                groups.map((g) => (
                  <div key={g.gradeId}>
                    <div className="qms-detail-group-head">
                      <span className="font-medium qms-detail-group-name">{g.gradeName}</span>
                      <span className="qms-text-sm text-muted">
                        {g.designs.length} mix design{g.designs.length === 1 ? '' : 's'}
                      </span>
                    </div>
                    <div className="qms-table-container">
                      <table className="qms-table">
                        <thead>
                          <tr><th>W/C ratio</th><th>Cement</th><th>28-day strength</th><th>Approval</th><th>Added</th></tr>
                        </thead>
                        <tbody>
                          {g.designs.map((m) => (
                            <tr key={m.mix_design_id}>
                              <td>{m.wc_ratio ?? '—'}</td>
                              <td>{m.cement_type ? m.cement_type.replace('_', ' ') : '—'}</td>
                              <td>{m.strength_28day_mpa != null ? `${m.strength_28day_mpa} MPa` : '—'}</td>
                              <td>
                                {m.approval_status
                                  ? <Badge variant={APPROVAL_VARIANT[m.approval_status]}>{m.approval_status.replace('_', ' ')}</Badge>
                                  : '—'}
                              </td>
                              <td>{new Date(m.created_at).toLocaleDateString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
};
