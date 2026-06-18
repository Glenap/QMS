import React from 'react';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { ChevronUp } from 'lucide-react';
import './ProjectMasterForm.css';

export const LabRegistrationForm: React.FC = () => {
  return (
    <div style={{ background: '#F3F4F6', minHeight: '100vh', padding: '40px 20px' }}>
      <div className="qms-form-page" style={{ background: '#fff', padding: 32, borderRadius: 12, boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
        <div className="qms-page-header-block" style={{ borderBottom: '1px solid var(--gray-200)', paddingBottom: 24, marginBottom: 32 }}>
          <div>
            <h1 className="qms-page-title-main" style={{ color: 'var(--blue)' }}>External Lab Registration</h1>
            <p className="qms-page-subtitle">Welcome to the QMS Platform. Please register your laboratory details to receive cube samples from Godrej Splendour Phase 2.</p>
          </div>
        </div>

        <div className="qms-auto-banner" style={{ marginBottom: 32, padding: 16 }}>
          <div className="qms-auto-field"><label>Project Name</label><span>Godrej Splendour Phase 2</span></div>
          <div className="qms-auto-field"><label>Invited By</label><span>L&T Construction (Main Contractor)</span></div>
          <div className="qms-auto-field"><label>Invitation Token</label><span>TOK-9981-ABCD</span></div>
        </div>

        <Card className="qms-form-section">
          <div className="qms-section-header-toggle">
            <h3 className="qms-section-heading-plain">A · LABORATORY DETAILS</h3>
            <ChevronUp size={16} className="text-muted" />
          </div>
          <div className="qms-grid-2">
            <Input label="Laboratory Name" required placeholder="e.g. ENVTECH Testing Lab" style={{ gridColumn: 'span 2' }} />
            
            <Input label="Registration Number" required />
            <Input label="GST Number" required />
            
            <Input label="Address Line 1" required style={{ gridColumn: 'span 2' }} />
            
            <Input label="City" required />
            <Select label="State" required options={[
              { label: 'Maharashtra', value: 'MH' },
              { label: 'Karnataka', value: 'KA' },
              { label: 'Delhi', value: 'DL' }
            ]} />
          </div>
        </Card>

        <Card className="qms-form-section">
          <div className="qms-section-header-toggle">
            <h3 className="qms-section-heading-plain">B · CONTACT DETAILS</h3>
            <ChevronUp size={16} className="text-muted" />
          </div>
          <div className="qms-grid-2">
            <Input label="Lab Manager Name" required />
            <Input label="Email ID" required type="email" />
            
            <Input label="Mobile Number" required type="tel" />
            <Input label="Alternate Phone" type="tel" />
          </div>
        </Card>

        <Card className="qms-form-section">
          <div className="qms-section-header-toggle">
            <h3 className="qms-section-heading-plain">C · ACCREDITATION & EQUIPMENT</h3>
            <ChevronUp size={16} className="text-muted" />
          </div>
          <div className="qms-grid-2">
            <Select label="NABL Accredited?" required options={[
              { label: 'Yes', value: 'Yes' },
              { label: 'No', value: 'No' },
              { label: 'In Progress', value: 'In Progress' }
            ]} />
            <Input label="NABL Certificate No." />
            
            <Input label="NABL Expiry Date" type="date" />
            <Select label="CTM Calibration Status" required options={[
              { label: 'Valid', value: 'Valid' },
              { label: 'Expired', value: 'Expired' }
            ]} />
            
            <Input label="CTM Calibration Expiry" required type="date" />
            <Input label="CTM Capacity (kN)" required type="number" />
          </div>
        </Card>

        <div className="qms-form-footer">
          <div className="text-muted qms-text-sm"><span className="text-danger">*</span> Mandatory field</div>
          <div className="qms-page-actions">
            <Button variant="primary">Submit Registration</Button>
          </div>
        </div>
      </div>
    </div>
  );
};
