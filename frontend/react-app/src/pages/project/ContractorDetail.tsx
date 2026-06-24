// One contractor's detail: header + Suppliers / Labs tabs (filtered to the
// suppliers & labs that contractor hired). Suppliers drill into SupplierDetail.

import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { useProject } from '../../components/layout/ProjectLayout';
import { projectsApi } from '../../api/projects';
import { suppliersApi } from '../../api/suppliers';
import { labsApi } from '../../api/labs';
import { mixDesignsApi } from '../../api/mixDesigns';
import { getApiErrorMessage } from '../../api/client';
import type {
  ConfirmationStatus,
  ContractorLinkStatus,
  LabResponse,
  MixDesignResponse,
  ProjectContractor,
  SupplierResponse,
} from '../../types/master';

const STATUS_BADGE: Record<ContractorLinkStatus, { variant: 'pass' | 'pending' | 'fail'; label: string }> = {
  ACCEPTED: { variant: 'pass', label: 'Accepted' },
  PENDING: { variant: 'pending', label: 'Pending' },
  DECLINED: { variant: 'fail', label: 'Declined' },
};
const CONF_VARIANT: Record<ConfirmationStatus, 'pass' | 'warn' | 'fail'> = {
  CONFIRMED: 'pass', PENDING: 'warn', DECLINED: 'fail',
};
const CONF_LABEL: Record<ConfirmationStatus, string> = {
  CONFIRMED: 'Confirmed', PENDING: 'Pending', DECLINED: 'Declined',
};

type Tab = 'suppliers' | 'labs';

const TabButton: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer',
      font: 'inherit', fontSize: 14, fontWeight: active ? 600 : 500,
      color: active ? 'var(--blue-700, #1D4ED8)' : 'var(--gray-600)',
      borderBottom: `2px solid ${active ? 'var(--blue-500, #3B82F6)' : 'transparent'}`,
      marginBottom: -1,
    }}
  >
    {children}
  </button>
);

export const ContractorDetail: React.FC = () => {
  const { project } = useProject();
  const navigate = useNavigate();
  const pid = project.project_id;
  const { contractorOrgId } = useParams();
  const orgId = Number(contractorOrgId);

  const [contractor, setContractor] = useState<ProjectContractor | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierResponse[]>([]);
  const [labs, setLabs] = useState<LabResponse[]>([]);
  const [mixDesigns, setMixDesigns] = useState<MixDesignResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('suppliers');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [pcs, sup, lb, md] = await Promise.all([
          projectsApi.contractors(pid),
          suppliersApi.list(pid),
          labsApi.list(pid),
          mixDesignsApi.list(pid),
        ]);
        if (cancelled) return;
        setContractor(pcs.find((c) => c.contractor_org_id === orgId) ?? null);
        setSuppliers(sup.filter((s) => s.contractor_org_id === orgId));
        setLabs(lb.filter((l) => l.contractor_org_id === orgId));
        setMixDesigns(md);
      } catch (err) {
        if (!cancelled) setError(getApiErrorMessage(err, 'Unable to load this contractor.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [pid, orgId]);

  const mdCount = (supplierId: number) => mixDesigns.filter((m) => m.supplier_id === supplierId).length;

  return (
    <div>
      <button className="qms-pw-back" onClick={() => navigate(`/app/projects/${pid}/contractors`)}>
        <ChevronLeft size={16} /> Contractors
      </button>

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 14, background: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5' }}>
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-muted qms-text-sm">Loading…</p>
      ) : !contractor ? (
        <p className="text-muted qms-text-sm">Contractor not found.</p>
      ) : (
        <>
          <Card className="qms-form-section">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h2 className="qms-pw-title" style={{ margin: 0 }}>{contractor.contractor_org_name}</h2>
              <Badge variant={STATUS_BADGE[contractor.status].variant}>{STATUS_BADGE[contractor.status].label}</Badge>
            </div>
            <p className="qms-text-sm text-muted" style={{ margin: '8px 0 0' }}>
              Scope: {contractor.scope ?? 'Entire project'} · Added {new Date(contractor.assigned_at).toLocaleDateString()}
            </p>
          </Card>

          <Card className="qms-form-section" padding="none">
            <div className="qms-border-b" style={{ display: 'flex', gap: 4, padding: '0 12px' }}>
              <TabButton active={tab === 'suppliers'} onClick={() => setTab('suppliers')}>
                RMC suppliers ({suppliers.length})
              </TabButton>
              <TabButton active={tab === 'labs'} onClick={() => setTab('labs')}>
                Testing labs ({labs.length})
              </TabButton>
            </div>

            {tab === 'suppliers' ? (
              <div className="qms-table-container">
                <table className="qms-table">
                  <thead>
                    <tr><th>Supplier</th><th>Plant</th><th>Mix designs</th><th>Confirmation</th><th></th></tr>
                  </thead>
                  <tbody>
                    {suppliers.length === 0 ? (
                      <tr><td colSpan={5} className="text-muted">No suppliers hired yet.</td></tr>
                    ) : (
                      suppliers.map((s) => (
                        <tr
                          key={s.supplier_id}
                          onClick={() => navigate(`/app/projects/${pid}/suppliers/${s.supplier_id}`)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td className="font-medium">{s.supplier_name}</td>
                          <td>{s.plant_name ?? s.plant_location ?? '—'}</td>
                          <td>{mdCount(s.supplier_id)}</td>
                          <td><Badge variant={CONF_VARIANT[s.status]}>{CONF_LABEL[s.status]}</Badge></td>
                          <td style={{ textAlign: 'right' }}><ChevronRight size={16} className="text-muted" /></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="qms-table-container">
                <table className="qms-table">
                  <thead>
                    <tr><th>Lab</th><th>Type</th><th>Location</th><th>Contact</th><th>Confirmation</th></tr>
                  </thead>
                  <tbody>
                    {labs.length === 0 ? (
                      <tr><td colSpan={5} className="text-muted">No labs hired yet.</td></tr>
                    ) : (
                      labs.map((l) => (
                        <tr key={l.lab_id}>
                          <td className="font-medium">{l.lab_name}</td>
                          <td>{l.lab_type === 'THIRD_PARTY' ? 'Third party' : 'In-house'}</td>
                          <td>{[l.city, l.state].filter(Boolean).join(', ') || '—'}</td>
                          <td>{l.contact_email ?? l.contact_phone ?? '—'}</td>
                          <td><Badge variant={CONF_VARIANT[l.status]}>{CONF_LABEL[l.status]}</Badge></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
};
