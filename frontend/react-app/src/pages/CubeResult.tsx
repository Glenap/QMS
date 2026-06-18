import React from 'react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { X, AlertTriangle, Link as LinkIcon, MessageCircle } from 'lucide-react';
import './CubeResult.css';

export const CubeResult: React.FC = () => {
  return (
    <div className="qms-result-page">
      <div className="qms-result-banner qms-result-banner--fail">
        <div className="qms-result-icon"><X size={32} /></div>
        <div className="qms-result-content">
          <div className="qms-result-label">FAIL — 37.2 MPa</div>
          <div className="qms-result-sub">M40 specified (min individual: 38.5 MPa per IS 456)</div>
          <div className="qms-result-meta">Cube C048 · 28-day test · Tested 29-Jun-2024</div>
        </div>
        <div className="qms-result-stats">
          <div className="qms-stats-label">Characteristic strength achieved</div>
          <div className="qms-stats-value">93.0%</div>
          <div className="qms-stats-warn">Below 100% threshold</div>
        </div>
      </div>

      <div className="qms-auto-banner">
        <div className="qms-auto-field">
          <label>Result ID</label>
          <span>RES-2024-1045</span>
        </div>
        <div className="qms-auto-field">
          <label>Pour card</label>
          <span>PC-T1-5F-SLB-20240601-001</span>
        </div>
        <div className="qms-auto-field">
          <label>Location</label>
          <span>T1 · 5F · Slab</span>
        </div>
        <div className="qms-auto-field">
          <label>Grade</label>
          <span>M40</span>
        </div>
        <div className="qms-auto-field">
          <label>Supplier</label>
          <span>UltraTech RMC Whitefield</span>
        </div>
        <div className="qms-auto-field">
          <label>Cast date</label>
          <span>01-Jun-2024</span>
        </div>
      </div>

      <div className="qms-grid-2-col">
        <Card className="qms-timeline-card">
          <h3 className="qms-card-title">Test age timeline</h3>
          <div className="qms-timeline">
            <div className="qms-timeline-row">
              <div className="qms-tl-age">7 day</div>
              <div className="qms-tl-bar-wrapper">
                <div className="qms-tl-bar" style={{ width: '67%', background: 'var(--green)' }}></div>
              </div>
              <div className="qms-tl-val text-success">26.8 MPa</div>
              <Badge variant="pass">Pass</Badge>
            </div>
            
            <div className="qms-timeline-row">
              <div className="qms-tl-age">14 day</div>
              <div className="qms-tl-bar-wrapper">
                <div className="qms-tl-bar" style={{ width: '80%', background: 'var(--amber)' }}></div>
              </div>
              <div className="qms-tl-val text-warning">32.1 MPa</div>
              <Badge variant="warn">Watch</Badge>
            </div>

            <div className="qms-timeline-row">
              <div className="qms-tl-age">28 day</div>
              <div className="qms-tl-bar-wrapper">
                <div className="qms-tl-bar" style={{ width: '93%', background: 'var(--red)' }}></div>
              </div>
              <div className="qms-tl-val text-danger">37.2 MPa</div>
              <Badge variant="fail">Fail</Badge>
            </div>
          </div>
        </Card>

        <Card padding="none">
          <div className="qms-details-header">Test details</div>
          <table className="qms-details-table">
            <tbody>
              <tr>
                <td className="text-muted">Failure load</td>
                <td className="text-right font-medium">1085 kN</td>
              </tr>
              <tr>
                <td className="text-muted">Cross-section area</td>
                <td className="text-right font-medium">22,500 mm²</td>
              </tr>
              <tr>
                <td className="text-muted">Calculated strength</td>
                <td className="text-right font-medium text-danger">37.2 MPa</td>
              </tr>
              <tr>
                <td className="text-muted">Failure pattern</td>
                <td className="text-right">Satisfactory (cone)</td>
              </tr>
              <tr>
                <td className="text-muted">Tested by</td>
                <td className="text-right">Anitha Raj</td>
              </tr>
              <tr>
                <td className="text-muted">Lab</td>
                <td className="text-right">ENVTECH</td>
              </tr>
            </tbody>
          </table>
        </Card>
      </div>

      <Card className="qms-action-card">
        <h3 className="qms-action-title"><AlertTriangle size={18} /> Failure actions</h3>
        <p className="qms-action-desc">
          NCR auto-raised: <strong>NCR-2024-015</strong> · Notifications sent to QA Manager, PM, Contractor Admin
        </p>
        <div className="qms-action-buttons">
          <Button variant="outline" size="sm" icon={<LinkIcon size={14}/>}>
            View traceability chain
          </Button>
          <Button variant="outline" size="sm" icon={<AlertTriangle size={14}/>}>
            Open NCR-2024-015
          </Button>
          <Button variant="outline" size="sm" icon={<MessageCircle size={14}/>}>
            Ask chatbot: who is responsible?
          </Button>
        </div>
      </Card>
    </div>
  );
};
