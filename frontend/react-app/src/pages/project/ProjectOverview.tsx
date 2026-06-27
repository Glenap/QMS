import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CheckCircle2, Circle, Users, Truck, Building, FileText, ChevronRight } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { useProject } from '../../components/layout/ProjectLayout';
import { useProjectMembers } from '../../queries/team';
import { useProjectContractors } from '../../queries/contractors';
import { useSuppliers } from '../../queries/suppliers';
import { useLabs } from '../../queries/labs';
import { useAnalyticsOverview, useAnalyticsQuality } from '../../queries/analytics';
import '../Dashboard.css';
import './ProjectOverview.css';

const fmtNum = (n: number | null | undefined): string => (n == null ? '—' : n.toLocaleString());
const fmtPct = (n: number | null | undefined): string => (n == null ? '—' : `${n}%`);

const ChecklistItem: React.FC<{ done: boolean; children: React.ReactNode }> = ({ done, children }) => (
  <div className="qms-checklist-item">
    {done ? <CheckCircle2 size={18} className="text-success" /> : <Circle size={18} className="text-muted" />}
    <span className={done ? 'qms-checklist-done' : 'text-muted'}>{children}</span>
  </div>
);

const Kpi: React.FC<{ label: string; value: string; note?: string }> = ({ label, value, note }) => (
  <Card padding="sm" className="qms-kpi-card">
    <div className="qms-kpi-label">{label}</div>
    <div className="qms-kpi-value">{value}</div>
    {note && <div className="qms-kpi-delta qms-kpi-delta--warn">{note}</div>}
  </Card>
);

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
  const { data: quality } = useAnalyticsQuality(pid);

  const counts = {
    members: members.length,
    contractorsTotal: contractors.length,
    contractorsAccepted: contractors.filter((c) => c.status === 'ACCEPTED').length,
    suppliers: suppliers.length,
    labs: labs.length,
  };

  // Overall monthly pass rate = total passes / total tests in each period.
  const trend = useMemo(() => {
    if (!quality) return [];
    const byPeriod = new Map<string, { pass: number; total: number }>();
    for (const pt of quality.grade_trend) {
      const acc = byPeriod.get(pt.period) ?? { pass: 0, total: 0 };
      acc.pass += pt.pass_count;
      acc.total += pt.test_count;
      byPeriod.set(pt.period, acc);
    }
    return [...byPeriod.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, { pass, total }]) => ({
        name: period,
        rate: total ? Math.round((pass / total) * 1000) / 10 : 0,
      }));
  }, [quality]);

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

      <div className="qms-kpi-grid">
        <Kpi label="Total pours" value={fmtNum(kpis?.pour_count)} note={kpis ? `${fmtNum(kpis.pour_volume_cum)} m³ poured` : undefined} />
        <Kpi label="Pass rate" value={fmtPct(kpis?.pass_rate_pct)} note={kpis ? `${fmtNum(kpis.test_count)} tests` : undefined} />
        <Kpi label="Open NCRs" value={fmtNum(kpis?.ncr_open)} note={kpis ? `${fmtNum(kpis.critical_count)} critical` : undefined} />
        <Kpi label="Avg strength" value={kpis?.avg_strength_mpa != null ? `${kpis.avg_strength_mpa} MPa` : '—'} note={kpis ? `${fmtPct(kpis.acceptance_pct)} truck accept` : undefined} />
      </div>

      <div className="qms-dashboard-charts">
        <Card className="qms-chart-card">
          <h3 className="qms-chart-title">Monthly pass rate</h3>
          <div className="qms-chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="pr" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--green)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--green)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--gray-500)' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: 'var(--gray-500)' }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Area type="monotone" dataKey="rate" stroke="var(--green)" strokeWidth={2} fillOpacity={1} fill="url(#pr)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {trend.length === 0 && (
            <p className="qms-text-sm text-muted qms-mt-8">
              Live cube-test metrics appear here once tests are recorded for this project.
            </p>
          )}
        </Card>

        <Card className="qms-chart-card">
          <h3 className="qms-chart-title">Project setup</h3>
          <div className="qms-checklist">
            <ChecklistItem done={counts.members > 0}>Team members assigned ({counts.members})</ChecklistItem>
            {isClient && (
              <ChecklistItem done={counts.contractorsAccepted > 0}>
                Contractor onboarded ({counts.contractorsAccepted}/{counts.contractorsTotal} accepted)
              </ChecklistItem>
            )}
            <ChecklistItem done={counts.suppliers > 0}>RMC suppliers registered ({counts.suppliers})</ChecklistItem>
            <ChecklistItem done={counts.labs > 0}>Testing labs registered ({counts.labs})</ChecklistItem>
          </div>
        </Card>
      </div>
    </div>
  );
};
