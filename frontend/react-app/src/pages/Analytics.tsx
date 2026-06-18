import React from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, RadarChart,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import { Card } from '../components/ui/Card';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { Download } from 'lucide-react';
import './Analytics.css';

const passRateTrend = [
  { month: 'Jan', M40: 88, M35: 91, M30: 95 },
  { month: 'Feb', M40: 86, M35: 89, M30: 92 },
  { month: 'Mar', M40: 90, M35: 93, M30: 96 },
  { month: 'Apr', M40: 87, M35: 90, M30: 94 },
  { month: 'May', M40: 91, M35: 94, M30: 97 },
  { month: 'Jun', M40: 93, M35: 96, M30: 98 },
];

const supplierPerformance = [
  { supplier: 'UltraTech', pours: 98, passRate: 94.2, avgStrength: 48.1 },
  { supplier: 'ACC', pours: 74, passRate: 88.0, avgStrength: 44.3 },
  { supplier: 'Premia RMC', pours: 52, passRate: 91.3, avgStrength: 46.8 },
  { supplier: 'Nuvoco', pours: 23, passRate: 82.6, avgStrength: 41.9 },
];

const strengthDistribution = [
  { range: '< 35', count: 4 },
  { range: '35–38', count: 12 },
  { range: '38–42', count: 63 },
  { range: '42–46', count: 87 },
  { range: '46–50', count: 54 },
  { range: '> 50', count: 27 },
];

const towerProgress = [
  { subject: 'T1 Emerald', A: 92 },
  { subject: 'T2 Sapphire', A: 76 },
  { subject: 'T3 Pearl', A: 54 },
];

export const Analytics: React.FC = () => {
  return (
    <div className="qms-analytics">
      <div className="qms-analytics-header">
        <div>
          <h1 className="qms-page-title-main">Analytics</h1>
          <p className="qms-page-subtitle">Concrete quality performance across all towers & suppliers</p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Select
            options={[
              { label: 'All Towers', value: 'ALL' },
              { label: 'T1 – Emerald', value: 'T1' },
              { label: 'T2 – Sapphire', value: 'T2' },
              { label: 'T3 – Pearl', value: 'T3' },
            ]}
            fullWidth={false}
          />
          <Button variant="outline" icon={<Download size={14} />}>Export PDF</Button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="qms-an-kpi-row">
        <div className="qms-an-kpi">
          <div className="qms-an-kpi-val">247</div>
          <div className="qms-an-kpi-label">Total Pours</div>
        </div>
        <div className="qms-an-kpi">
          <div className="qms-an-kpi-val" style={{ color: 'var(--green)' }}>91.4%</div>
          <div className="qms-an-kpi-label">Overall Pass Rate</div>
        </div>
        <div className="qms-an-kpi">
          <div className="qms-an-kpi-val">45.6 MPa</div>
          <div className="qms-an-kpi-label">Avg. 28-day Strength</div>
        </div>
        <div className="qms-an-kpi">
          <div className="qms-an-kpi-val" style={{ color: 'var(--red)' }}>21</div>
          <div className="qms-an-kpi-label">Total Failures</div>
        </div>
        <div className="qms-an-kpi">
          <div className="qms-an-kpi-val" style={{ color: 'var(--amber)' }}>8</div>
          <div className="qms-an-kpi-label">Borderline Results</div>
        </div>
        <div className="qms-an-kpi">
          <div className="qms-an-kpi-val">3</div>
          <div className="qms-an-kpi-label">Open NCRs</div>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="qms-an-grid-2">
        <Card>
          <h3 className="qms-chart-heading">Pass Rate Trend by Grade (%)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={passRateTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis domain={[80, 100]} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="M40" stroke="var(--blue)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="M35" stroke="var(--green)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="M30" stroke="var(--amber)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <h3 className="qms-chart-heading">Strength Distribution — 28 Day (MPa)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={strengthDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
              <XAxis dataKey="range" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Bar dataKey="count" fill="var(--blue)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="qms-an-grid-2">
        <Card>
          <h3 className="qms-chart-heading">Supplier Performance Comparison</h3>
          <div className="qms-supplier-table">
            <div className="qms-sup-head">
              <span>Supplier</span>
              <span>Pours</span>
              <span>Pass Rate</span>
              <span>Avg MPa</span>
              <span>Trend</span>
            </div>
            {supplierPerformance.map(s => (
              <div key={s.supplier} className="qms-sup-row">
                <span className="font-medium">{s.supplier}</span>
                <span>{s.pours}</span>
                <span style={{ color: s.passRate >= 90 ? 'var(--green)' : s.passRate >= 85 ? 'var(--amber)' : 'var(--red)', fontWeight: 600 }}>
                  {s.passRate}%
                </span>
                <span>{s.avgStrength}</span>
                <div className="qms-mini-bar">
                  <div className="qms-mini-bar-fill"
                    style={{
                      width: `${s.passRate}%`,
                      background: s.passRate >= 90 ? 'var(--green)' : s.passRate >= 85 ? 'var(--amber)' : 'var(--red)'
                    }}>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="qms-chart-heading">Tower Progress Completion</h3>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={towerProgress}>
              <PolarGrid stroke="var(--gray-200)" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
              <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Radar name="Progress" dataKey="A" stroke="var(--blue)" fill="var(--blue)" fillOpacity={0.2} />
            </RadarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Charts Row 3 */}
      <Card>
        <h3 className="qms-chart-heading">Monthly Cube Volume vs Failures</h3>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={passRateTrend.map((d, i) => ({ ...d, cubes: [120, 98, 145, 112, 167, 203][i], fails: [8, 11, 7, 14, 10, 5][i] }))}>
            <defs>
              <linearGradient id="cubeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--blue)" stopOpacity={0.15} />
                <stop offset="95%" stopColor="var(--blue)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip />
            <Legend />
            <Area type="monotone" dataKey="cubes" stroke="var(--blue)" fill="url(#cubeGrad)" strokeWidth={2} name="Cubes tested" />
            <Area type="monotone" dataKey="fails" stroke="var(--red)" fill="transparent" strokeWidth={2} name="Failures" strokeDasharray="4 2" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
};
