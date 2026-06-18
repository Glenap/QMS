import React from 'react';
import { Calendar, CheckSquare, Clock, FileText, ArrowRight, ShieldAlert, AlertTriangle } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import './AuditManagement.css';

const UPCOMING_AUDITS = [
  { id: 'AUD-2024-06', title: 'Q2 Internal Quality Audit', date: '25-Jun-2024', auditor: 'Safety Team', type: 'Internal', status: 'Scheduled' },
  { id: 'AUD-2024-07', title: 'ISO 9001 Surveillance Audit', date: '12-Jul-2024', auditor: 'BSI Group', type: 'External', status: 'Planned' },
  { id: 'AUD-2024-08', title: 'Supplier Assessment: UltraTech', date: '18-Jul-2024', auditor: 'Vendor QA', type: 'Supplier', status: 'Planned' },
];

const PAST_AUDITS = [
  { id: 'AUD-2024-03', title: 'Q1 Site Safety Walkthrough', date: '15-Mar-2024', score: 92, findings: 2, status: 'Closed' },
  { id: 'AUD-2024-02', title: 'Material Testing Lab Inspection', date: '05-Feb-2024', score: 85, findings: 5, status: 'Open CAPA' },
  { id: 'AUD-2024-01', title: 'Annual Process Audit', date: '10-Jan-2024', score: 98, findings: 0, status: 'Closed' },
];

export const AuditManagement: React.FC = () => {
  return (
    <div className="qms-page">
      <div className="qms-page-header">
        <div>
          <h1 className="qms-page-title">Audit Management</h1>
          <p className="qms-page-sub">Plan, schedule, and track internal and external quality audits.</p>
        </div>
        <div className="qms-audit-actions">
          <Button variant="outline" icon={<CheckSquare size={16}/>}>Checklists</Button>
          <Button variant="primary" icon={<Calendar size={16}/>}>Schedule Audit</Button>
        </div>
      </div>

      <div className="qms-audit-grid">
        <div className="qms-audit-main">
          <Card className="qms-audit-card">
            <h2 className="qms-section-title">Upcoming Audits</h2>
            <div className="qms-upcoming-list">
              {UPCOMING_AUDITS.map(audit => (
                <div key={audit.id} className="qms-upcoming-item">
                  <div className="qms-upcoming-date">
                    <div className="qms-date-month">{audit.date.split('-')[1]}</div>
                    <div className="qms-date-day">{audit.date.split('-')[0]}</div>
                  </div>
                  <div className="qms-upcoming-info">
                    <h4 className="qms-upcoming-title">{audit.title}</h4>
                    <div className="qms-upcoming-meta">
                      <span>{audit.id}</span> &bull; <span>{audit.auditor}</span> &bull; <span>{audit.type}</span>
                    </div>
                  </div>
                  <div className="qms-upcoming-status">
                    <Badge variant={audit.status === 'Scheduled' ? 'pass' : 'warn'}>{audit.status}</Badge>
                    <button className="qms-icon-btn"><ArrowRight size={16}/></button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="qms-audit-card">
            <h2 className="qms-section-title">Past Audits & Findings</h2>
            <div className="qms-table-container">
              <table className="qms-table">
                <thead>
                  <tr>
                    <th>Audit Title</th>
                    <th>Date</th>
                    <th>Score</th>
                    <th>Findings</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {PAST_AUDITS.map(audit => (
                    <tr key={audit.id}>
                      <td className="font-medium">{audit.title}</td>
                      <td>{audit.date}</td>
                      <td>
                        <span className={`qms-score ${audit.score >= 90 ? 'text-success' : 'text-warning'}`}>
                          {audit.score}%
                        </span>
                      </td>
                      <td>
                        {audit.findings > 0 ? (
                          <span className="qms-findings-badge">
                            <AlertTriangle size={12} /> {audit.findings} Open
                          </span>
                        ) : (
                          <span className="text-muted">None</span>
                        )}
                      </td>
                      <td>
                        {audit.status === 'Closed' ? (
                          <Badge variant="pass">Closed</Badge>
                        ) : (
                          <Badge variant="fail">Open CAPA</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="qms-audit-sidebar">
          <Card className="qms-audit-summary" padding="sm">
            <h3 className="qms-summary-title">Compliance Score</h3>
            <div className="qms-summary-score">94.2%</div>
            <p className="qms-summary-desc">Average across all internal audits this year.</p>
            
            <div className="qms-summary-stats">
              <div className="qms-stat-row">
                <span>Total Audits (YTD)</span>
                <span className="font-medium">12</span>
              </div>
              <div className="qms-stat-row">
                <span>Open Findings</span>
                <span className="font-medium text-danger">7</span>
              </div>
              <div className="qms-stat-row">
                <span>Overdue CAPAs</span>
                <span className="font-medium text-warning">2</span>
              </div>
            </div>
            <Button variant="outline" className="qms-full-btn" icon={<FileText size={16}/>}>View Compliance Report</Button>
          </Card>

          <Card className="qms-quick-actions" padding="sm">
            <h3 className="qms-summary-title">Quick Actions</h3>
            <button className="qms-action-btn">
              <ShieldAlert size={16} className="text-primary" />
              <span>Review Open Findings</span>
            </button>
            <button className="qms-action-btn">
              <CheckSquare size={16} className="text-accent" />
              <span>Manage Checklists</span>
            </button>
            <button className="qms-action-btn">
              <Clock size={16} className="text-warning" />
              <span>Follow-up Reminders</span>
            </button>
          </Card>
        </div>
      </div>
    </div>
  );
};
