import React from 'react';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { ChevronUp } from 'lucide-react';
import './ProjectMasterForm.css'; // Reusing layout CSS

export const ContractorRegistrationForm: React.FC = () => {
  return (
    <div className="qms-form-page">
      <div className="qms-page-header-block">
        <div>
          <h1 className="qms-page-title-main">Contractor Registration</h1>
          <p className="qms-page-subtitle">Filled by: Client Admin (sends invite) → Organisation fills own details | Purpose: Register Contractors, Consultants, PMC and Sub-Contractors</p>
        </div>
        <div className="qms-page-actions">
          <Button variant="outline">Save Draft</Button>
          <Button variant="primary">Submit</Button>
        </div>
      </div>

      <div className="qms-auto-banner" style={{ marginBottom: 24, padding: 16 }}>
        <div className="qms-auto-field"><label>Project ID *</label><span>PRJ-2024-001</span></div>
        <div className="qms-auto-field"><label>Project Name</label><span>Godrej Splendour Phase 2</span></div>
        <div className="qms-auto-field"><label>Invitation ID</label><span>INV-2024-042</span></div>
        <div className="qms-auto-field"><label>Invited By</label><span>Rajesh Sharma</span></div>
        <div className="qms-auto-field"><label>Invitation Date</label><span>10-Apr-2024</span></div>
        <div className="qms-auto-field"><label>Invitation Expiry</label><span>17-Apr-2024</span></div>
      </div>

      <Card className="qms-form-section">
        <div className="qms-section-header-toggle">
          <h3 className="qms-section-heading-plain">B · ORGANISATION DETAILS</h3>
          <ChevronUp size={16} className="text-muted" />
        </div>
        <div className="qms-grid-2">
          <Select label="Organisation Type" required options={[
            { label: 'Contractor', value: 'Contractor' },
            { label: 'Sub-Contractor', value: 'Sub-Contractor' },
            { label: 'Consultant', value: 'Consultant' },
            { label: 'PMC', value: 'PMC' },
          ]} />
          <Input label="Company Name" required placeholder="Registered company name" />
          
          <Input label="Company Short Name" required placeholder="e.g. L&T" />
          <Input label="Registration Number" placeholder="CIN / Company reg. number" />
          
          <Input label="GST Number" required />
          <Input label="PAN Number" />
          
          <Input label="Website" placeholder="www.company.com" type="url" />
        </div>
      </Card>

      <Card className="qms-form-section">
        <div className="qms-section-header-toggle">
          <h3 className="qms-section-heading-plain">C · CONTACT DETAILS</h3>
          <ChevronUp size={16} className="text-muted" />
        </div>
        <div className="qms-grid-2">
          <Input label="Contact Person Name" required />
          <Input label="Designation" required />
          
          <Input label="Email ID" required type="email" />
          <Input label="Mobile Number" required type="tel" />
          
          <Input label="Alternate Phone" type="tel" />
          <Input label="Registered Address" required />
          
          <Input label="Site Office Address" />
        </div>
      </Card>

      <Card className="qms-form-section">
        <div className="qms-section-header-toggle">
          <h3 className="qms-section-heading-plain">D · CONTRACT / SCOPE</h3>
          <ChevronUp size={16} className="text-muted" />
        </div>
        <div className="qms-grid-2">
          <Input label="Scope of Work" required placeholder="Brief description of contracted scope" style={{ gridColumn: 'span 2' }} />
          
          <Input label="Contract Value (INR)" type="number" />
          <Input label="Contract Start Date" required type="date" />
          
          <Input label="Contract End Date" required type="date" />
          <Input label="Assigned Towers" required placeholder="e.g. T1, T2" />
          
          <Input label="Work Package / LOT" />
          <Select label="Parent Contractor" options={[{ label: 'None', value: '' }]} />
        </div>
      </Card>

      <Card className="qms-form-section">
        <div className="qms-section-header-toggle">
          <h3 className="qms-section-heading-plain">E · DOCUMENTS & COMPLIANCE</h3>
          <ChevronUp size={16} className="text-muted" />
        </div>
        <div className="qms-grid-2">
          <Input label="Trade Licence Number" />
          <Input label="ISO Certification" />
          
          <Input label="EPF Registration" />
          <Input label="ESI Registration" />
          
          <Input label="Insurance Policy No." />
          <Input label="Insurance Expiry" type="date" />
          
          <Input label="Safety Certification" />
        </div>
      </Card>

      <Card className="qms-form-section">
        <div className="qms-section-header-toggle">
          <h3 className="qms-section-heading-plain">F · STATUS & APPROVAL</h3>
          <ChevronUp size={16} className="text-muted" />
        </div>
        <div className="qms-grid-2">
          <Select label="Acceptance Status" required options={[
            { label: 'Invited', value: 'Invited' },
            { label: 'Accepted', value: 'Accepted' },
            { label: 'Rejected', value: 'Rejected' },
            { label: 'Revoked', value: 'Revoked' }
          ]} />
          <Input label="Acceptance Date" type="date" />
          
          <Select label="Approval Status" required options={[
            { label: 'Pending Approval', value: 'Pending Approval' },
            { label: 'Approved', value: 'Approved' },
            { label: 'On Hold', value: 'On Hold' },
            { label: 'Blacklisted', value: 'Blacklisted' }
          ]} />
          <Input label="Approved By" />
          
          <Input label="Approval Date" type="date" />
          <Select label="Active Status" required options={[
            { label: 'Active', value: 'Active' },
            { label: 'Inactive', value: 'Inactive' },
            { label: 'Suspended', value: 'Suspended' }
          ]} />
          
          <Input label="Remarks" style={{ gridColumn: 'span 2' }} />
        </div>
      </Card>

      <div className="qms-form-footer">
        <div className="text-muted qms-text-sm"><span className="text-danger">*</span> Mandatory field</div>
        <div className="qms-page-actions">
          <Button variant="outline">Save Draft</Button>
          <Button variant="primary">Submit</Button>
        </div>
      </div>
    </div>
  );
};
