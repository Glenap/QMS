import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CheckCircle2, Circle, Users, Truck, Building, FileText, ChevronRight } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { useProject } from '../../components/layout/ProjectLayout';
import { projectsApi } from '../../api/projects';
import { suppliersApi } from '../../api/suppliers';
import { labsApi } from '../../api/labs';
import '../Dashboard.css';

interface Counts {
  members: number;
  contractorsAccepted: number;
  contractorsTotal: number;
  suppliers: number;
  labs: number;
}

const SAMPLE_TREND = [
  { name: 'Jan', rate: 0 }, { name: 'Feb', rate: 0 }, { name: 'Mar', rate: 0 },
  { name: 'Apr', rate: 0 }, { name: 'May', rate: 0 }, { name: 'Jun', rate: 0 },
];

const ChecklistItem: React.FC<{ done: boolean; children: React.ReactNode }> = ({ done, children }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', fontSize: 14 }}>
    {done ? <CheckCircle2 size={18} className="text-success" /> : <Circle size={18} className="text-muted" />}
    <span style={{ color: done ? 'var(--gray-800)' : 'var(--gray-500)' }}>{children}</span>
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
  const [counts, setCounts] = useState<Counts | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [members, contractors, suppliers, labs] = await Promise.all([
          projectsApi.members(pid),
          project.access.side === 'CLIENT' ? projectsApi.contractors(pid) : Promise.resolve([]),
          suppliersApi.list(pid),
          labsApi.list(pid),
        ]);
        if (cancelled) return;
        setCounts({
          members: members.length,
          contractorsTotal: contractors.length,
          contractorsAccepted: contractors.filter((c) => c.status === 'ACCEPTED').length,
          suppliers: suppliers.length,
          labs: labs.length,
        });
      } catch {
        if (!cancelled) setCounts({ members: 0, contractorsTotal: 0, contractorsAccepted: 0, suppliers: 0, labs: 0 });
      }
    })();
    return () => { cancelled = true; };
  }, [pid, project.access.side]);

  const quickLinks = [
    { label: 'Team', icon: <Users size={18} />, to: `/app/projects/${pid}/team`, count: counts?.members },
    ...(project.access.side === 'CLIENT'
      ? [{ label: 'Contractors', icon: <Building size={18} />, to: `/app/projects/${pid}/contractors`, count: counts?.contractorsAccepted }]
      : []),
    { label: 'Suppliers', icon: <Truck size={18} />, to: `/app/projects/${pid}/suppliers`, count: counts?.suppliers },
    { label: 'Labs', icon: <FileText size={18} />, to: `/app/projects/${pid}/labs`, count: counts?.labs },
  ];

  return (
    <div className="qms-dashboard">
      <div className="qms-kpi-grid">
        {quickLinks.map((q) => (
          <Card key={q.label} padding="sm" className="qms-kpi-card" onClick={() => navigate(q.to)} style={{ cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="text-muted">{q.icon}</span>
                <span style={{ fontWeight: 600 }}>{q.label}</span>
              </div>
              <ChevronRight size={16} className="text-muted" />
            </div>
            {q.count != null && <div className="qms-kpi-value" style={{ fontSize: 22, marginTop: 4 }}>{q.count}</div>}
          </Card>
        ))}
      </div>

      <div className="qms-kpi-grid">
        <Kpi label="Total pours" value="—" note="Coming soon" />
        <Kpi label="Pass rate" value="—" note="Coming soon" />
        <Kpi label="Open NCRs" value="—" note="Coming soon" />
        <Kpi label="Pending cube tests" value="—" note="Coming soon" />
      </div>

      <div className="qms-dashboard-charts">
        <Card className="qms-chart-card">
          <h3 className="qms-chart-title">Monthly pass rate</h3>
          <div className="qms-chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={SAMPLE_TREND}>
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
          <p className="qms-text-sm text-muted" style={{ marginTop: 8 }}>
            Live cube-test metrics appear here once pours are logged for this project.
          </p>
        </Card>

        <Card className="qms-chart-card">
          <h3 className="qms-chart-title">Project setup</h3>
          <div style={{ padding: '4px 2px' }}>
            <ChecklistItem done={(counts?.members ?? 0) > 0}>Team members assigned ({counts?.members ?? 0})</ChecklistItem>
            {project.access.side === 'CLIENT' && (
              <ChecklistItem done={(counts?.contractorsAccepted ?? 0) > 0}>
                Contractor onboarded ({counts?.contractorsAccepted ?? 0}/{counts?.contractorsTotal ?? 0} accepted)
              </ChecklistItem>
            )}
            <ChecklistItem done={(counts?.suppliers ?? 0) > 0}>RMC suppliers registered ({counts?.suppliers ?? 0})</ChecklistItem>
            <ChecklistItem done={(counts?.labs ?? 0) > 0}>Testing labs registered ({counts?.labs ?? 0})</ChecklistItem>
          </div>
        </Card>
      </div>
    </div>
  );
};
