import React from 'react';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { ChevronUp } from 'lucide-react';
import './ProjectMasterForm.css';

export const UserRegistrationForm: React.FC = () => {
  return (
    <div className="qms-form-page">
      <div className="qms-page-header-block">
        <div>
          <h1 className="qms-page-title-main">User Registration</h1>
          <p className="qms-page-subtitle">Filled by: Contractor Admin | Purpose: Register project personnel with roles, permissions and assignments</p>
        </div>
        <div className="qms-page-actions">
          <Button variant="outline">Save Draft</Button>
          <Button variant="primary">Create User</Button>
        </div>
      </div>

      <div className="qms-auto-banner" style={{ marginBottom: 24, padding: 16 }}>
        <div className="qms-auto-field"><label>Project ID *</label><span>PRJ-2024-001</span></div>
        <div className="qms-auto-field"><label>Contractor ID *</label><span>CON-001</span></div>
        <div className="qms-auto-field"><label>User ID *</label><span>USR-2024-105</span></div>
        <div className="qms-auto-field"><label>Created Date *</label><span>10-Apr-2024</span></div>
        <div className="qms-auto-field"><label>Created By *</label><span>Admin</span></div>
      </div>

      <Card className="qms-form-section">
        <div className="qms-section-header-toggle">
          <h3 className="qms-section-heading-plain">B · USER IDENTITY</h3>
          <ChevronUp size={16} className="text-muted" />
        </div>
        <div className="qms-grid-2">
          <Input label="Full Name" required placeholder="As per company ID" />
          <Input label="Employee ID" required placeholder="e.g. EMP-LT-2019-04521" />
          
          <Input label="Designation" required placeholder="Official job title" />
          <Input label="Organisation" required placeholder="Employer company name" />
          
          <Select label="Department" options={[
            { label: 'Quality', value: 'Quality' },
            { label: 'Planning', value: 'Planning' },
            { label: 'Safety', value: 'Safety' },
            { label: 'Civil', value: 'Civil' }
          ]} />
          <Input label="Date of Joining" type="date" />
        </div>
      </Card>

      <Card className="qms-form-section">
        <div className="qms-section-header-toggle">
          <h3 className="qms-section-heading-plain">C · CONTACT</h3>
          <ChevronUp size={16} className="text-muted" />
        </div>
        <div className="qms-grid-2">
          <Input label="Email ID" required type="email" />
          <Input label="Mobile Number" required type="tel" />
          
          <Input label="Alternate Email" type="email" />
          <Input label="Emergency Contact" placeholder="Name & phone" />
        </div>
      </Card>

      <Card className="qms-form-section">
        <div className="qms-section-header-toggle">
          <h3 className="qms-section-heading-plain">D · ROLE & ACCESS</h3>
          <ChevronUp size={16} className="text-muted" />
        </div>
        <div className="qms-grid-2">
          <Select label="System Role" required options={[
            { label: 'Project Manager', value: 'Project Manager' },
            { label: 'Quality Manager', value: 'Quality Manager' },
            { label: 'Supervisor', value: 'Supervisor' }
          ]} />
          <Select label="Access Level" required options={[
            { label: 'Admin', value: 'Admin' },
            { label: 'Full Edit', value: 'Full Edit' },
            { label: 'Data Entry', value: 'Data Entry' },
            { label: 'View Only', value: 'View Only' }
          ]} />
          
          <div style={{ gridColumn: 'span 2' }}>
            <label className="qms-input-label">Module Access *</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              {['Pour Card', 'RMC', 'Lab Results', 'NCR', 'Dashboard'].map(m => (
                <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, background: 'var(--gray-50)', padding: '6px 12px', borderRadius: 16, border: '1px solid var(--gray-200)' }}>
                  <input type="checkbox" defaultChecked /> {m}
                </label>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card className="qms-form-section">
        <div className="qms-section-header-toggle">
          <h3 className="qms-section-heading-plain">E · ASSIGNMENT</h3>
          <ChevronUp size={16} className="text-muted" />
        </div>
        <div className="qms-grid-2">
          <Input label="Assigned Towers" required placeholder="e.g. T1, T2 or ALL" />
          <Input label="Assigned Floors" placeholder="e.g. 1F–15F or ALL" />
          
          <Input label="Assigned Zone" placeholder="e.g. North Core" />
          <Select label="Shift" options={[
            { label: 'Day', value: 'Day' },
            { label: 'Night', value: 'Night' },
            { label: 'Both', value: 'Both' }
          ]} />
          
          <Input label="Reporting To" placeholder="Direct supervisor name and role" />
        </div>
      </Card>

      <Card className="qms-form-section">
        <div className="qms-section-header-toggle">
          <h3 className="qms-section-heading-plain">F · STATUS</h3>
          <ChevronUp size={16} className="text-muted" />
        </div>
        <div className="qms-grid-2">
          <Select label="Account Status" required options={[
            { label: 'Active', value: 'Active' },
            { label: 'Inactive', value: 'Inactive' },
            { label: 'Suspended', value: 'Suspended' }
          ]} />
          <Input label="Last Login" readOnly disabled value="Auto-updated by system" />
        </div>
      </Card>

      <div className="qms-form-footer">
        <div className="text-muted qms-text-sm"><span className="text-danger">*</span> Mandatory field</div>
        <div className="qms-page-actions">
          <Button variant="outline">Save Draft</Button>
          <Button variant="primary">Create User</Button>
        </div>
      </div>
    </div>
  );
};
