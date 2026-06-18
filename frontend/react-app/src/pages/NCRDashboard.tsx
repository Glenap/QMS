import React, { useState } from 'react';
import { AlertTriangle, Plus, Filter, LayoutGrid, List, CheckCircle, Clock, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import './NCRDashboard.css';

const NCR_DATA = [
  { id: 'NCR-24-081', issue: 'Honeycombing in Column C4', location: 'T1 · 5F', severity: 'High', status: 'Root Cause Analysis', age: '3 days', owner: 'Site Engineer' },
  { id: 'NCR-24-080', issue: 'Cube Test Failure - M40', location: 'T1 · 5F · Slab', severity: 'Critical', status: 'CAPA Implementation', age: '5 days', owner: 'Quality Manager' },
  { id: 'NCR-24-079', issue: 'Slump test below spec', location: 'T2 · 3F', severity: 'Medium', status: 'Closed', age: '12 days', owner: 'QA Engineer' },
  { id: 'NCR-24-078', issue: 'Rebar spacing off by 20mm', location: 'T3 · 1F · Raft', severity: 'Low', status: 'Pending Review', age: '1 day', owner: 'Structural Eng.' },
];

export const NCRDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');

  const getSeverityBadge = (severity: string) => {
    switch(severity) {
      case 'Critical': return <Badge variant="fail">Critical</Badge>;
      case 'High': return <Badge variant="warn">High</Badge>;
      case 'Medium': return <Badge variant="pending">Medium</Badge>;
      default: return <Badge variant="pass">Low</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'Closed': return <Badge variant="pass" icon={<CheckCircle size={12}/>}>Closed</Badge>;
      case 'CAPA Implementation': return <Badge variant="warn" icon={<Clock size={12}/>}>Action</Badge>;
      default: return <Badge variant="pending">Open</Badge>;
    }
  };

  return (
    <div className="qms-page">
      <div className="qms-page-header">
        <div>
          <h1 className="qms-page-title">NC & CAPA Management</h1>
          <p className="qms-page-sub">Track non-conformances, root cause analysis, and corrective actions.</p>
        </div>
        <div className="qms-ncr-actions">
          <div className="qms-view-toggles">
            <button className={`qms-view-toggle ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}>
              <List size={16} />
            </button>
            <button className={`qms-view-toggle ${viewMode === 'kanban' ? 'active' : ''}`} onClick={() => setViewMode('kanban')}>
              <LayoutGrid size={16} />
            </button>
          </div>
          <Button variant="primary" icon={<Plus size={16}/>} onClick={() => navigate('/app/ncr/new')}>Log New NCR</Button>
        </div>
      </div>

      <div className="qms-ncr-kpis">
        <Card className="qms-ncr-kpi-card" padding="sm">
          <div className="qms-ncr-kpi-header">
            <AlertTriangle size={20} className="text-danger" />
            <span className="qms-ncr-kpi-title">Open NCRs</span>
          </div>
          <div className="qms-ncr-kpi-val">14</div>
          <div className="qms-ncr-kpi-meta text-danger">+3 this week</div>
        </Card>
        <Card className="qms-ncr-kpi-card" padding="sm">
          <div className="qms-ncr-kpi-header">
            <Clock size={20} className="text-warning" />
            <span className="qms-ncr-kpi-title">Avg. Resolution Time</span>
          </div>
          <div className="qms-ncr-kpi-val">8.2 days</div>
          <div className="qms-ncr-kpi-meta text-success">-1.5 days vs last month</div>
        </Card>
        <Card className="qms-ncr-kpi-card" padding="sm">
          <div className="qms-ncr-kpi-header">
            <CheckCircle size={20} className="text-success" />
            <span className="qms-ncr-kpi-title">CAPA Effectiveness</span>
          </div>
          <div className="qms-ncr-kpi-val">92%</div>
          <div className="qms-ncr-kpi-meta text-success">Target: 95%</div>
        </Card>
      </div>

      {viewMode === 'list' ? (
        <Card padding="none" className="qms-ncr-list-card">
          <div className="qms-ncr-toolbar">
            <Button variant="outline" size="sm" icon={<Filter size={14}/>}>Filter Issues</Button>
          </div>
          <div className="qms-table-container">
            <table className="qms-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Issue Description</th>
                  <th>Location</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Age</th>
                  <th>Owner</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {NCR_DATA.map(ncr => (
                  <tr key={ncr.id}>
                    <td className="font-medium text-primary">{ncr.id}</td>
                    <td className="font-medium">{ncr.issue}</td>
                    <td>{ncr.location}</td>
                    <td>{getSeverityBadge(ncr.severity)}</td>
                    <td>{getStatusBadge(ncr.status)}</td>
                    <td>{ncr.age}</td>
                    <td>{ncr.owner}</td>
                    <td>
                      <button className="qms-icon-btn"><ArrowRight size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <div className="qms-ncr-kanban">
          {['Pending Review', 'Root Cause Analysis', 'CAPA Implementation', 'Closed'].map(stage => (
            <div key={stage} className="qms-kanban-column">
              <h3 className="qms-kanban-header">
                {stage} <span className="qms-kanban-count">{NCR_DATA.filter(n => n.status === stage).length}</span>
              </h3>
              <div className="qms-kanban-cards">
                {NCR_DATA.filter(n => n.status === stage).map(ncr => (
                  <Card key={ncr.id} className="qms-kanban-card" padding="sm">
                    <div className="qms-kanban-card-top">
                      <span className="font-medium text-primary">{ncr.id}</span>
                      {getSeverityBadge(ncr.severity)}
                    </div>
                    <div className="qms-kanban-card-title">{ncr.issue}</div>
                    <div className="qms-kanban-card-meta">
                      <span>{ncr.location}</span>
                      <span>{ncr.owner}</span>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
