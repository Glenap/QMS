import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, Star, TrendingUp, TrendingDown, Mail, FileText, CheckCircle, AlertTriangle } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import './SupplierDashboard.css';

const SUPPLIERS = [
  { id: 'SUP-001', name: 'UltraTech RMC', type: 'Concrete', rating: 4.8, passRate: 94, trend: 'up', status: 'Approved', activeContract: true },
  { id: 'SUP-002', name: 'ACC Concrete', type: 'Concrete', rating: 4.2, passRate: 88, trend: 'down', status: 'Probation', activeContract: true },
  { id: 'SUP-003', name: 'Tata Steel', type: 'Rebar', rating: 4.9, passRate: 99, trend: 'up', status: 'Approved', activeContract: true },
  { id: 'SUP-004', name: 'Godrej Material', type: 'Aggregates', rating: 4.5, passRate: 91, trend: 'up', status: 'Approved', activeContract: false },
];

export const SupplierDashboard: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="qms-page">
      <div className="qms-page-header">
        <div>
          <h1 className="qms-page-title">Vendor Collaboration</h1>
          <p className="qms-page-sub">Monitor supplier performance, manage contracts, and track quality metrics.</p>
        </div>
        <Button variant="primary" icon={<Truck size={16}/>} onClick={() => navigate('/app/suppliers/new')}>Onboard Vendor</Button>
      </div>

      <div className="qms-supplier-grid">
        {SUPPLIERS.map(sup => (
          <Card key={sup.id} className="qms-supplier-card">
            <div className="qms-sup-header">
              <div className="qms-sup-title-area">
                <h3 className="qms-sup-name">{sup.name}</h3>
                <Badge variant={sup.status === 'Approved' ? 'pass' : 'warn'}>{sup.status}</Badge>
              </div>
              <div className="qms-sup-type">{sup.type} Provider</div>
            </div>

            <div className="qms-sup-metrics">
              <div className="qms-sup-metric">
                <div className="qms-sup-metric-val">
                  {sup.rating} <Star size={16} fill="currentColor" className="text-warning" />
                </div>
                <div className="qms-sup-metric-lbl">Overall Rating</div>
              </div>
              <div className="qms-sup-metric">
                <div className="qms-sup-metric-val">
                  {sup.passRate}% 
                  {sup.trend === 'up' ? <TrendingUp size={16} className="text-success ml-1"/> : <TrendingDown size={16} className="text-danger ml-1"/>}
                </div>
                <div className="qms-sup-metric-lbl">Quality Pass Rate</div>
              </div>
            </div>

            <div className="qms-sup-details">
              <div className="qms-sup-detail-item">
                <FileText size={14} className="text-gray-400" />
                <span>Contract: {sup.activeContract ? <span className="text-success">Active</span> : <span className="text-warning">Expired</span>}</span>
              </div>
              <div className="qms-sup-detail-item">
                <CheckCircle size={14} className="text-gray-400" />
                <span>Last Audit: 12-May-2024</span>
              </div>
              {sup.status === 'Probation' && (
                <div className="qms-sup-detail-item text-danger">
                  <AlertTriangle size={14} />
                  <span>3 Open NCRs</span>
                </div>
              )}
            </div>

            <div className="qms-sup-actions">
              <Button variant="outline" size="sm" icon={<Mail size={14}/>}>Message</Button>
              <Button variant="outline" size="sm" icon={<FileText size={14}/>}>Scorecard</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
