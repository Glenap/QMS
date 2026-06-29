import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bar, BarChart, CartesianGrid, Legend,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Users, Truck, Building, FileText, ChevronRight } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { KpiStrip } from '../../components/analytics/KpiStrip';
import { useProject } from '../../components/layout/ProjectLayout';
import { useProjectMembers } from '../../queries/team';
import { useProjectContractors } from '../../queries/contractors';
import { useSuppliers } from '../../queries/suppliers';
import { useLabs } from '../../queries/labs';
import {
  useAnalyticsOverview, useSupplierScores, useNcrsBySupplier,
} from '../../queries/analytics';
import '../Dashboard.css';
import './ProjectOverview.css';

const fmtNum = (n: number | null | undefined): string => (n == null ? '—' : n.toLocaleString());
const fmtPct = (n: number | null | undefined): string => (n == null ? '—' : `${n}%`);

export const ProjectOverview: React.FC = () => {
  const { project } = useProject();
  const navigate = useNavigate();
  const pid = project.project_id;
  const isClient = project.access.side === 'CLIENT';

  const { data: members = [] } = useProjectMembers(pid);
  const { data: contractors = [] } = useProjectContractors(pid, isClient);
  const { data: suppliers = [] } = useSuppliers(pid);
  const { data: labs = [] } = useLabs(pid);
  const { data: kpis = null } = useAnalyticsOverview(pid);
  const { data: supplierScores = [] } = useSupplierScores(pid);
  const { data: ncrBySupplier = [] } = useNcrsBySupplier(pid);

  const counts = {
    members: members.length,
    contractorsAccepted: contractors.filter((c) => c.status === 'ACCEPTED').length,
    suppliers: suppliers.length,
    labs: labs.length,
  };

  // Pass rate per RMC supplier (only those with tests), best first. The overall
  // whole-project pass rate lives in the KPI strip; the month-by-month trend is
  // a filterable view that belongs on the Analytics page, not here.
  const supplierPass = useMemo(
    () =>
      supplierScores
        .filter((s) => s.test_count > 0)
        .map((s) => ({ name: s.supplier_name, rate: s.pass_rate_pct ?? 0 }))
        .sort((a, b) => b.rate - a.rate),
    [supplierScores],
  );

  // NCRs by supplier (open / closed / critical), worst first. Whole-project —
  // the dashboard is never filtered.
  const ncrChart = useMemo(
    () =>
      ncrBySupplier
        .filter((s) => s.total > 0)
        .map((s) => ({
          name: s.supplier_name,
          Open: s.open_count,
          Closed: s.closed_count,
          Critical: s.critical_count,
        }))
        .sort((a, b) => (b.Open + b.Closed) - (a.Open + a.Closed)),
    [ncrBySupplier],
  );

  // The overall-data KPI strip (whole project). The Analytics page shows the
  // same strip, but filtered by tower / grade / date.
  const failures = kpis ? kpis.fail_count + kpis.critical_count : null;
  const kpiItems = [
    { label: 'Total Pours', value: fmtNum(kpis?.pour_count) },
    { label: 'Overall Pass Rate', value: fmtPct(kpis?.pass_rate_pct), color: 'var(--green)' },
    { label: 'Avg. Strength', value: kpis?.avg_strength_mpa != null ? `${kpis.avg_strength_mpa} MPa` : '—' },
    { label: 'Total Failures', value: failures != null ? String(failures) : '—', color: 'var(--red)' },
    { label: 'Critical Failures', value: kpis ? String(kpis.critical_count) : '—', color: 'var(--amber)' },
    // "Open" = not yet closed (open + under review), matching the Analytics strip.
    { label: 'Open NCRs', value: kpis ? String(kpis.ncr_open + kpis.ncr_under_review) : '—' },
  ];

  const quickLinks = [
    { label: 'Team', icon: <Users size={18} />, to: `/app/projects/${pid}/team`, count: counts.members },
    ...(isClient
      ? [{ label: 'Contractors', icon: <Building size={18} />, to: `/app/projects/${pid}/contractors`, count: counts.contractorsAccepted }]
      : []),
    { label: 'Suppliers', icon: <Truck size={18} />, to: `/app/projects/${pid}/suppliers`, count: counts.suppliers },
    { label: 'Labs', icon: <FileText size={18} />, to: `/app/projects/${pid}/labs`, count: counts.labs },
  ];

  return (
    <div className="qms-dashboard">
      <div className="qms-kpi-grid">
        {quickLinks.map((q) => (
          <Card
            key={q.label}
            padding="sm"
            className="qms-kpi-card qms-quicklink"
            role="button"
            tabIndex={0}
            onClick={() => navigate(q.to)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(q.to); } }}
          >
            <div className="qms-quicklink-head">
              <div className="qms-quicklink-label">
                <span className="text-muted">{q.icon}</span>
                <span className="qms-quicklink-title">{q.label}</span>
              </div>
              <ChevronRight size={16} className="text-muted" />
            </div>
            <div className="qms-kpi-value qms-quicklink-count">{q.count}</div>
          </Card>
        ))}
      </div>

      <KpiStrip items={kpiItems} />

      <div className="qms-dashboard-charts">
        <Card className="qms-chart-card">
          <h3 className="qms-chart-title">Pass rate by RMC supplier</h3>
          <div className="qms-chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={supplierPass}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--gray-500)' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: 'var(--gray-500)' }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="rate" name="Pass rate %" fill="var(--blue)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {supplierPass.length === 0 && (
            <p className="qms-text-sm text-muted qms-mt-8">
              Supplier pass rates appear once cube tests are recorded for this project.
            </p>
          )}
        </Card>

        <Card className="qms-chart-card">
          <h3 className="qms-chart-title">NCRs by RMC supplier (open · closed · critical)</h3>
          <div className="qms-chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ncrChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--gray-500)' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'var(--gray-500)' }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Open" name="Open" fill="var(--amber)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Closed" name="Closed" fill="var(--green)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Critical" name="Critical" fill="var(--red)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {ncrChart.length === 0 && (
            <p className="qms-text-sm text-muted qms-mt-8">
              No NCRs raised yet — no supplier has a failed cube test.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
};
