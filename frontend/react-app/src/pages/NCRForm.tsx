import React from 'react';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { ChevronUp, AlertTriangle } from 'lucide-react';
import './ProjectMasterForm.css';

export const NCRForm: React.FC = () => {
  return (
    <div className="qms-form-page">
      <div className="qms-page-header-block">
        <div>
          <h1 className="qms-page-title-main">Non-Conformance Report (NCR)</h1>
          <p className="qms-page-subtitle">Auto-generated from Cube Failure | Complete Investigation and Root Cause</p>
        </div>
        <div className="qms-page-actions">
          <Button variant="outline">Save Draft</Button>
          <Button variant="primary">Submit NCR</Button>
        </div>
      </div>

      <div className="qms-auto-banner" style={{ marginBottom: 24, padding: 16, background: '#FEF2F2', borderColor: '#FCA5A5' }}>
        <div className="qms-auto-field">
          <label style={{ color: 'var(--red)' }}>NCR ID *</label>
          <span style={{ color: 'var(--red)' }}>NCR-2024-015</span>
        </div>
        <div className="qms-auto-field">
          <label style={{ color: 'var(--red)' }}>Linked Result ID</label>
          <span style={{ color: 'var(--red)' }}>RES-2024-1045 (Cube Fail)</span>
        </div>
        <div className="qms-auto-field">
          <label style={{ color: 'var(--red)' }}>Severity</label>
          <span style={{ color: 'var(--red)' }}>HIGH - Structural</span>
        </div>
        <div className="qms-auto-field">
          <label style={{ color: 'var(--red)' }}>Date Raised</label>
          <span style={{ color: 'var(--red)' }}>29-Jun-2024</span>
        </div>
      </div>

      <Card className="qms-form-section">
        <div className="qms-section-header-toggle">
          <h3 className="qms-section-heading-plain">B · INCIDENT DETAILS</h3>
          <ChevronUp size={16} className="text-muted" />
        </div>
        <div className="qms-grid-2">
          <Input label="Description of Non-Conformance" required defaultValue="28-day cube test failed. Achieved 37.2 MPa against required 40 MPa for T1 5F Slab." style={{ gridColumn: 'span 2' }} />
          
          <Input label="Location" readOnly disabled value="T1 · 5F · Slab" />
          <Input label="Supplier" readOnly disabled value="UltraTech RMC Whitefield" />
          
          <Select label="Responsible Party" required options={[
            { label: 'Supplier (RMC)', value: 'Supplier (RMC)' },
            { label: 'Contractor (Execution)', value: 'Contractor (Execution)' },
            { label: 'Lab (Testing Error)', value: 'Lab (Testing Error)' }
          ]} />
          <Input label="Estimated Volume Affected (m³)" type="number" defaultValue={210} />
        </div>
      </Card>

      <Card className="qms-form-section">
        <div className="qms-section-header-toggle">
          <h3 className="qms-section-heading-plain">C · ROOT CAUSE ANALYSIS</h3>
          <ChevronUp size={16} className="text-muted" />
        </div>
        <div className="qms-grid-2">
          <Select label="Primary Cause Category" required options={[
            { label: 'Material Quality (Mix Design/Cement)', value: 'Material Quality' },
            { label: 'Execution (Curing/Vibration)', value: 'Execution' },
            { label: 'Transit (Water added/Delay)', value: 'Transit' },
          ]} />
          <Input label="Detailed Root Cause" required placeholder="Explain why this happened..." style={{ gridColumn: 'span 2' }} />
          
          <Input label="Supporting Evidence/Docs" type="file" />
        </div>
      </Card>

      <Card className="qms-form-section">
        <div className="qms-section-header-toggle">
          <h3 className="qms-section-heading-plain">D · CORRECTIVE & PREVENTIVE ACTION (CAPA)</h3>
          <ChevronUp size={16} className="text-muted" />
        </div>
        <div className="qms-grid-2">
          <Input label="Immediate Correction (Disposition)" required placeholder="e.g. Stop pour, NDT ordered" style={{ gridColumn: 'span 2' }} />
          
          <Select label="Proposed Structural Action" required options={[
            { label: 'Accept as is (Concession)', value: 'Accept as is' },
            { label: 'Repair / Retrofit', value: 'Repair / Retrofit' },
            { label: 'Demolish and Recast', value: 'Demolish and Recast' }
          ]} />
          <Input label="Preventive Action" placeholder="e.g. Restrict water addition at site" />
          
          <Input label="CAPA Assigned To" required placeholder="Name/Role" />
          <Input label="Target Closure Date" required type="date" />
        </div>
      </Card>

      <Card className="qms-form-section">
        <div className="qms-section-header-toggle">
          <h3 className="qms-section-heading-plain">E · PENALTY & COMMERCIALS</h3>
          <ChevronUp size={16} className="text-muted" />
        </div>
        <div className="qms-grid-2">
          <Select label="Penalty Applicable?" required options={[
            { label: 'Yes', value: 'Yes' },
            { label: 'No', value: 'No' }
          ]} />
          <Input label="Penalty Amount (INR)" type="number" />
          
          <Input label="Deduct From" placeholder="e.g. UltraTech RA Bill 04" style={{ gridColumn: 'span 2' }} />
        </div>
      </Card>

      <div className="qms-form-footer">
        <div className="text-muted qms-text-sm"><span className="text-danger">*</span> Mandatory field</div>
        <div className="qms-page-actions">
          <Button variant="outline">Save Draft</Button>
          <Button variant="danger" icon={<AlertTriangle size={16}/>}>Submit NCR</Button>
        </div>
      </div>
    </div>
  );
};
