import React from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowUpRight, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import './Dashboard.css';

const data = [
  { name: 'Jan', rate: 87.2 },
  { name: 'Feb', rate: 88.5 },
  { name: 'Mar', rate: 86.8 },
  { name: 'Apr', rate: 89.1 },
  { name: 'May', rate: 90.3 },
  { name: 'Jun', rate: 91.4 },
];

export const Dashboard: React.FC = () => {
  return (
    <div className="qms-dashboard">
      <div className="qms-kpi-grid">
        <Card padding="sm" className="qms-kpi-card">
          <div className="qms-kpi-label">Total pours</div>
          <div className="qms-kpi-value">247</div>
          <div className="qms-kpi-delta qms-kpi-delta--up">
            <ArrowUpRight size={14} /> 18 this month
          </div>
        </Card>
        <Card padding="sm" className="qms-kpi-card">
          <div className="qms-kpi-label">Pass rate</div>
          <div className="qms-kpi-value text-success">91.4%</div>
          <div className="qms-kpi-delta qms-kpi-delta--up">
            <ArrowUpRight size={14} /> +2.1% vs last month
          </div>
        </Card>
        <Card padding="sm" className="qms-kpi-card">
          <div className="qms-kpi-label">Open NCRs</div>
          <div className="qms-kpi-value text-danger">3</div>
          <div className="qms-kpi-delta qms-kpi-delta--down">
            2 overdue response
          </div>
        </Card>
        <Card padding="sm" className="qms-kpi-card">
          <div className="qms-kpi-label">Pending cube tests</div>
          <div className="qms-kpi-value text-warning">14</div>
          <div className="qms-kpi-delta qms-kpi-delta--warn">
            3 overdue today
          </div>
        </Card>
        <Card padding="sm" className="qms-kpi-card">
          <div className="qms-kpi-label">Active suppliers</div>
          <div className="qms-kpi-value">4</div>
          <div className="qms-kpi-delta qms-kpi-delta--warn">
            1 below 85% rate
          </div>
        </Card>
      </div>

      <div className="qms-dashboard-charts">
        <Card className="qms-chart-card">
          <h3 className="qms-chart-title">Monthly pass rate — last 6 months</h3>
          <div className="qms-chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--green)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--green)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--gray-500)' }} axisLine={false} tickLine={false} />
                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 12, fill: 'var(--gray-500)' }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Area type="monotone" dataKey="rate" stroke="var(--green)" strokeWidth={2} fillOpacity={1} fill="url(#colorRate)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="qms-chart-card">
          <h3 className="qms-chart-title">Supplier pass rate comparison</h3>
          <div className="qms-mini-chart">
            <div className="qms-bar-col">
              <div className="qms-bar qms-bar--pass" style={{ height: '94%' }}></div>
              <div className="qms-bar-label">UTC</div>
              <div className="qms-bar-val text-success">94%</div>
            </div>
            <div className="qms-bar-col">
              <div className="qms-bar qms-bar--pass-alt" style={{ height: '88%' }}></div>
              <div className="qms-bar-label">ACC</div>
              <div className="qms-bar-val text-success">88%</div>
            </div>
            <div className="qms-bar-col">
              <div className="qms-bar qms-bar--pass-alt2" style={{ height: '91%' }}></div>
              <div className="qms-bar-label">PRE</div>
              <div className="qms-bar-val text-success">91%</div>
            </div>
            <div className="qms-bar-col">
              <div className="qms-bar qms-bar--warn" style={{ height: '82%' }}></div>
              <div className="qms-bar-label">NUV</div>
              <div className="qms-bar-val text-warning">82%</div>
            </div>
          </div>
        </Card>
      </div>

      <div className="qms-section-header">
        <h2 className="qms-section-title">Recent cube test results</h2>
        <Button variant="outline" size="sm">View all</Button>
      </div>

      <Card padding="none">
        <div className="qms-table-container">
          <table className="qms-table">
            <thead>
              <tr>
                <th>Cube ID</th>
                <th>Location</th>
                <th>Grade</th>
                <th>Strength (MPa)</th>
                <th>Age</th>
                <th>Supplier</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-medium">C-047</td>
                <td>T1 · 5F · Slab</td>
                <td>M40</td>
                <td className="font-medium text-success">48.3</td>
                <td>28 day</td>
                <td>UltraTech RMC</td>
                <td><Badge variant="pass" icon={<CheckCircle size={12} />}>Pass</Badge></td>
                <td>29-Jun-24</td>
              </tr>
              <tr>
                <td className="font-medium">C-048</td>
                <td>T1 · 5F · Slab</td>
                <td>M40</td>
                <td className="font-medium text-danger">37.2</td>
                <td>28 day</td>
                <td>UltraTech RMC</td>
                <td><Badge variant="fail" icon={<XCircle size={12} />}>Fail</Badge></td>
                <td>29-Jun-24</td>
              </tr>
              <tr>
                <td className="font-medium">C-049</td>
                <td>T2 · 3F · Column</td>
                <td>M35</td>
                <td className="font-medium text-warning">34.8</td>
                <td>28 day</td>
                <td>ACC Concrete</td>
                <td><Badge variant="warn" icon={<AlertTriangle size={12} />}>Borderline</Badge></td>
                <td>28-Jun-24</td>
              </tr>
              <tr>
                <td className="font-medium">C-050</td>
                <td>T1 · 6F · Beam</td>
                <td>M30</td>
                <td className="font-medium text-success">36.5</td>
                <td>7 day</td>
                <td>Premia RMC</td>
                <td><Badge variant="pass" icon={<CheckCircle size={12} />}>Pass</Badge></td>
                <td>27-Jun-24</td>
              </tr>
              <tr>
                <td className="font-medium">C-051</td>
                <td>T3 · 1F · Raft</td>
                <td>M25</td>
                <td className="text-muted">—</td>
                <td>7 day</td>
                <td>UltraTech RMC</td>
                <td><Badge variant="pending">Pending</Badge></td>
                <td>Due 2-Jul-24</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
