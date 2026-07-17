import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bar, BarChart, CartesianGrid, Legend,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Users, Truck, Building, FileText, ChevronRight } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { KpiStrip } from '../../components/analytics/KpiStrip';
import { DateRangeFilter } from '../../components/analytics/DateRangeFilter';
import { presetRange, type DatePreset } from '../../components/analytics/dateRange';
import { useProject } from '../../components/layout/ProjectLayout';
import { useAuth } from '../../hooks/useAuth';
import { getApiErrorMessage } from '../../api/client';
import { toast } from '../../lib/toast';
import { useUpdateProjectStatus } from '../../queries/projects';
import { useProjectMembers } from '../../queries/team';
import { useProjectContractors } from '../../queries/contractors';
import { useSuppliers } from '../../queries/suppliers';
import { useLabs } from '../../queries/labs';
import {
  useAnalyticsOverview, useSupplierScores, useNcrsBySupplier,
} from '../../queries/analytics';
import { useProjectTowers } from '../../queries/floors';
import { useGrades } from '../../queries/catalog';
import type { ProjectStatus, QualityFilters } from '../../types/master';
import '../Dashboard.css';
import './ProjectOverview.css';

const fmtNum = (n: number | null | undefined): string => (n == null ? '—' : n.toLocaleString());
const fmtPct = (n: number | null | undefined): string => (n == null ? '—' : `${n}%`);

const STATUS_META: Record<ProjectStatus, { variant: 'pass' | 'warn' | 'info'; label: string }> = {
  ACTIVE: { variant: 'info', label: 'Active' },
  ON_HOLD: { variant: 'warn', label: 'On hold' },
  COMPLETED: { variant: 'pass', label: 'Completed' },
};

export const ProjectOverview: React.FC = () => {
  const { project } = useProject();
  const { user } = useAuth();
  const navigate = useNavigate();
  const pid = project.project_id;
  const isClient = project.access.side === 'CLIENT';
  const isOwner = user?.role === 'CLIENT_ADMIN' && isClient;

  const setStatus = useUpdateProjectStatus(pid);
  const confirm = useConfirm();

  const changeStatus = async (status: ProjectStatus) => {
    if (status === project.status) return;
    if (status === 'COMPLETED' && !(await confirm({
      title: 'Complete this project?',
      description: 'Its team members will be freed to join other projects. Data and analytics stay available.',
      confirmLabel: 'Complete project',
    }))) {
      return;
    }
    try {
      await setStatus.mutateAsync(status);
      toast.success(`Project marked ${STATUS_META[status].label.toLowerCase()}.`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Unable to update the project status.'));
    }
  };

  const { data: members = [] } = useProjectMembers(pid);
  const { data: contractors = [] } = useProjectContractors(pid, isClient);
  const { data: suppliers = [] } = useSuppliers(pid);
  const { data: labs = [] } = useLabs(pid);
  // Filters drive the two charts + supplier data below (the KPI strip stays
  // whole-project as the headline summary).
  const [towerId, setTowerId] = useState('ALL');
  const [gradeId, setGradeId] = useState('ALL');
  const [contractorId, setContractorId] = useState('ALL');
  const [preset, setPreset] = useState<DatePreset>('7');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const filters = useMemo<QualityFilters>(() => {
    const f: QualityFilters = {};
    if (towerId !== 'ALL') f.tower_id = Number(towerId);
    if (gradeId !== 'ALL') f.grade_id = Number(gradeId);
    if (contractorId !== 'ALL') f.contractor_id = Number(contractorId);
    const range = presetRange(preset, customFrom, customTo);
    if (range.date_from) f.date_from = range.date_from;
    if (range.date_to) f.date_to = range.date_to;
    return f;
  }, [towerId, gradeId, contractorId, preset, customFrom, customTo]);

  // Contractor filter options — accepted contractors only (client-side view).
  const contractorOpts = contractors
    .filter((c) => c.status === 'ACCEPTED')
    .map((c) => ({ label: c.contractor_org_name, value: c.contractor_org_id }));

  const { data: towers = [] } = useProjectTowers(pid);
  const { data: grades = [] } = useGrades();
  const { data: kpis = null } = useAnalyticsOverview(pid);
  const { data: supplierScores = [] } = useSupplierScores(pid, filters);
  const { data: ncrBySupplier = [] } = useNcrsBySupplier(pid, filters);

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

  // Whole-project headline KPIs — a simple, at-a-glance summary (not filtered).
  // "Total Failures" = fail + critical results; "Open" = NCRs not yet closed.
  const failures = kpis ? kpis.fail_count + kpis.critical_count : null;
  const kpiItems = [
    { label: 'Total Pours', value: fmtNum(kpis?.pour_count) },
    { label: 'Overall Pass Rate', value: fmtPct(kpis?.pass_rate_pct), color: 'var(--green)' },
    { label: 'Total Failures', value: failures != null ? String(failures) : '—', color: 'var(--red)' },
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
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 6 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="qms-text-sm text-muted">Project status</span>
          <Badge variant={STATUS_META[project.status].variant}>{STATUS_META[project.status].label}</Badge>
        </div>
        {isOwner && (
          <Select
            fullWidth={false}
            aria-label="Project status"
            value={project.status}
            disabled={setStatus.isPending}
            onChange={(e) => changeStatus(e.target.value as ProjectStatus)}
            options={[
              { label: 'Active', value: 'ACTIVE' },
              { label: 'On hold', value: 'ON_HOLD' },
              { label: 'Completed (frees team)', value: 'COMPLETED' },
            ]}
          />
        )}
      </div>

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

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', margin: '4px 0' }}>
        <Select label="Tower" fullWidth={false} value={towerId} onChange={(e) => setTowerId(e.target.value)}
          options={[{ label: 'All towers', value: 'ALL' }, ...towers.map((t) => ({ label: t.tower_name, value: t.tower_id }))]} />
        <Select label="Grade" fullWidth={false} value={gradeId} onChange={(e) => setGradeId(e.target.value)}
          options={[{ label: 'All grades', value: 'ALL' }, ...grades.map((g) => ({ label: g.grade_name, value: g.grade_id }))]} />
        {contractorOpts.length > 0 && (
          <Select label="Contractor" fullWidth={false} value={contractorId} onChange={(e) => setContractorId(e.target.value)}
            options={[{ label: 'All contractors', value: 'ALL' }, ...contractorOpts]} />
        )}
        <DateRangeFilter preset={preset} from={customFrom} to={customTo}
          onPreset={setPreset} onFrom={setCustomFrom} onTo={setCustomTo} />
      </div>

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
                <Bar dataKey="Open" name="Open" fill="#F59E0B" radius={[4, 4, 0, 0]} />
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
