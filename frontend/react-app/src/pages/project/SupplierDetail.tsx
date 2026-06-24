// One RMC supplier's detail: header + its mix designs grouped by grade.
// Reached from a contractor's Suppliers tab or the project Suppliers table.

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { useProject } from '../../components/layout/ProjectLayout';
import { suppliersApi } from '../../api/suppliers';
import { mixDesignsApi } from '../../api/mixDesigns';
import { getApiErrorMessage } from '../../api/client';
import type {
  ConfirmationStatus,
  MixApprovalStatus,
  MixDesignResponse,
  SupplierResponse,
} from '../../types/master';

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

  const [supplier, setSupplier] = useState<SupplierResponse | null>(null);
  const [designs, setDesigns] = useState<MixDesignResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [sups, mds] = await Promise.all([
          suppliersApi.list(pid),
          mixDesignsApi.list(pid),
        ]);
        if (cancelled) return;
        setSupplier(sups.find((s) => s.supplier_id === sid) ?? null);
        setDesigns(mds.filter((m) => m.supplier_id === sid));
      } catch (err) {
        if (!cancelled) setError(getApiErrorMessage(err, 'Unable to load this supplier.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [pid, sid]);

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
      <button className="qms-pw-back" onClick={() => navigate(backTo)}>
        <ChevronLeft size={16} /> {supplier?.contractor_org_name ?? 'Suppliers'}
      </button>

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 14, background: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5' }}>
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-muted qms-text-sm">Loading…</p>
      ) : !supplier ? (
        <p className="text-muted qms-text-sm">Supplier not found.</p>
      ) : (
        <>
          <Card className="qms-form-section">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h2 className="qms-pw-title" style={{ margin: 0 }}>{supplier.supplier_name}</h2>
              <Badge variant={CONF_VARIANT[supplier.status]}>{CONF_LABEL[supplier.status]}</Badge>
            </div>
            <div className="qms-text-sm text-muted" style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
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
            <div className="qms-p-4" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {groups.length === 0 ? (
                <p className="text-muted qms-text-sm" style={{ margin: 0 }}>No mix designs registered for this supplier yet.</p>
              ) : (
                groups.map((g) => (
                  <div key={g.gradeId}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span className="font-medium" style={{ fontSize: 15 }}>{g.gradeName}</span>
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
