// One contractor's detail: header + Suppliers / Labs tabs (filtered to the
// suppliers & labs that contractor hired). Suppliers drill into SupplierDetail.

import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { ErrorBox } from '../../components/ui/ErrorBox';
import { useProject } from '../../components/layout/ProjectLayout';
import { getApiErrorMessage } from '../../api/client';
import { useProjectContractors } from '../../queries/contractors';
import { useSuppliers } from '../../queries/suppliers';
import { useLabs } from '../../queries/labs';
import { useMixDesigns } from '../../queries/mixDesigns';
import type { ConfirmationStatus, ContractorLinkStatus } from '../../types/master';
import './Detail.css';

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
    className={`qms-detail-tab ${active ? 'qms-detail-tab--active' : ''}`}
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

  const contractorsQuery = useProjectContractors(pid);
  const suppliersQuery = useSuppliers(pid);
  const labsQuery = useLabs(pid);
  const mixDesignsQuery = useMixDesigns(pid);
  const loading = contractorsQuery.isPending || suppliersQuery.isPending || labsQuery.isPending || mixDesignsQuery.isPending;
  const loadError = contractorsQuery.error ?? suppliersQuery.error ?? labsQuery.error ?? mixDesignsQuery.error;

  const contractor = (contractorsQuery.data ?? []).find((c) => c.contractor_org_id === orgId) ?? null;
  const suppliers = (suppliersQuery.data ?? []).filter((s) => s.contractor_org_id === orgId);
  const labs = (labsQuery.data ?? []).filter((l) => l.contractor_org_id === orgId);
  const mixDesigns = mixDesignsQuery.data ?? [];

  const [tab, setTab] = useState<Tab>('suppliers');
  const mdCount = (supplierId: number) => mixDesigns.filter((m) => m.supplier_id === supplierId).length;

  return (
    <div>
      <button type="button" className="qms-pw-back" onClick={() => navigate(`/app/projects/${pid}/contractors`)}>
        <ChevronLeft size={16} /> Contractors
      </button>

      {loadError && <ErrorBox>{getApiErrorMessage(loadError, 'Unable to load this contractor.')}</ErrorBox>}

      {loading ? (
        <p className="text-muted qms-text-sm">Loading…</p>
      ) : !contractor ? (
        <p className="text-muted qms-text-sm">Contractor not found.</p>
      ) : (
        <>
          <Card className="qms-form-section">
            <div className="qms-detail-title-row">
              <h2 className="qms-pw-title">{contractor.contractor_org_name}</h2>
              <Badge variant={STATUS_BADGE[contractor.status].variant}>{STATUS_BADGE[contractor.status].label}</Badge>
            </div>
            <p className="qms-text-sm text-muted qms-mt-8">
              Scope: {contractor.scope ?? 'Entire project'} · Added {new Date(contractor.assigned_at).toLocaleDateString()}
            </p>
          </Card>

          <Card className="qms-form-section" padding="none">
            <div className="qms-border-b qms-detail-tabs">
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
                        <tr key={s.supplier_id}>
                          <td className="font-medium">
                            <button
                              type="button"
                              className="qms-linklike font-medium"
                              onClick={() => navigate(`/app/projects/${pid}/suppliers/${s.supplier_id}`)}
                            >
                              {s.supplier_name}
                            </button>
                          </td>
                          <td>{s.plant_name ?? s.plant_location ?? '—'}</td>
                          <td>{mdCount(s.supplier_id)}</td>
                          <td><Badge variant={CONF_VARIANT[s.status]}>{CONF_LABEL[s.status]}</Badge></td>
                          <td className="qms-detail-end"><ChevronRight size={16} className="text-muted" /></td>
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
