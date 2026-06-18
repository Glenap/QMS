import React from 'react';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { ChevronUp, Plus, Trash2 } from 'lucide-react';
import './ProjectMasterForm.css';

export const RMCSupplierForm: React.FC = () => {
  return (
    <div className="qms-form-page">
      <div className="qms-page-header-block">
        <div>
          <h1 className="qms-page-title-main">RMC Supplier Registration</h1>
          <p className="qms-page-subtitle">Filled by: Project Manager | Purpose: Register Ready Mix Concrete suppliers and approved mix designs</p>
        </div>
        <div className="qms-page-actions">
          <Button variant="outline">Save Draft</Button>
          <Button variant="primary">Register Supplier</Button>
        </div>
      </div>

      <div className="qms-auto-banner" style={{ marginBottom: 24, padding: 16 }}>
        <div className="qms-auto-field"><label>Project ID *</label><span>PRJ-2024-001</span></div>
        <div className="qms-auto-field"><label>Supplier ID *</label><span>SUP-2024-012</span></div>
        <div className="qms-auto-field"><label>Registration Date *</label><span>11-Apr-2024</span></div>
      </div>

      <Card className="qms-form-section">
        <div className="qms-section-header-toggle">
          <h3 className="qms-section-heading-plain">B · SUPPLIER DETAILS</h3>
          <ChevronUp size={16} className="text-muted" />
        </div>
        <div className="qms-grid-2">
          <Input label="Supplier Company Name" required placeholder="e.g. UltraTech Cement Ltd" />
          <Input label="Plant Name / Short Name" required placeholder="e.g. Whitefield Plant" />
          
          <Input label="GST Number" required />
          <Input label="PAN Number" />
          
          <Input label="Plant Address" required style={{ gridColumn: 'span 2' }} />
          
          <Input label="Distance from Site (km)" required type="number" />
          <Input label="Est. Transit Time (mins)" required type="number" />
        </div>
      </Card>

      <Card className="qms-form-section">
        <div className="qms-section-header-toggle">
          <h3 className="qms-section-heading-plain">C · CONTACT DETAILS</h3>
          <ChevronUp size={16} className="text-muted" />
        </div>
        <div className="qms-grid-2">
          <Input label="Primary Contact Name" required />
          <Input label="Designation" required />
          
          <Input label="Email ID" required type="email" />
          <Input label="Mobile Number" required type="tel" />
          
          <Input label="Dispatch/Plant Manager Name" required />
          <Input label="Dispatch Mobile Number" required type="tel" />
        </div>
      </Card>

      <Card className="qms-form-section">
        <div className="qms-section-header-toggle">
          <h3 className="qms-section-heading-plain">D · PLANT CAPABILITY</h3>
          <ChevronUp size={16} className="text-muted" />
        </div>
        <div className="qms-grid-2">
          <Input label="Plant Capacity (m³/hr)" required type="number" />
          <Input label="No. of Transit Mixers" required type="number" />
          
          <Input label="No. of Concrete Pumps" type="number" />
          <Select label="QMS Certification" options={[
            { label: 'ISO 9001', value: 'ISO 9001' },
            { label: 'QCI Approved', value: 'QCI Approved' },
            { label: 'None', value: 'None' }
          ]} />
        </div>
      </Card>

      <Card className="qms-form-section" padding="none">
        <div className="qms-p-4 qms-border-b">
          <div className="qms-section-header-toggle" style={{ marginBottom: 4 }}>
            <h3 className="qms-section-heading-plain">E · APPROVED MIX DESIGNS</h3>
            <ChevronUp size={16} className="text-muted" />
          </div>
          <p className="qms-text-sm text-muted">Register the concrete mix designs approved for this project from this supplier.</p>
        </div>
        <div className="qms-table-container">
          <table className="qms-table">
            <thead>
              <tr>
                <th>Mix Design ID *</th>
                <th>Concrete Grade *</th>
                <th>Type *</th>
                <th>Max Aggregate (mm)</th>
                <th>Cement Content (kg/m³)</th>
                <th>W/C Ratio *</th>
                <th>Target Slump (mm) *</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><Input /></td>
                <td><Select options={[{label:'M40',value:'M40'}, {label:'M30',value:'M30'}]} /></td>
                <td><Select options={[{label:'Pumpable',value:'Pumpable'}, {label:'SCC',value:'SCC'}]} /></td>
                <td><Input type="number" /></td>
                <td><Input type="number" /></td>
                <td><Input type="number" step="0.01" /></td>
                <td><Input type="number" /></td>
                <td><Button variant="ghost" icon={<Trash2 size={16} className="text-danger" />} /></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="qms-p-4">
          <Button variant="outline" className="qms-dashed-btn" icon={<Plus size={16} />}>Add Mix Design</Button>
        </div>
      </Card>

      <div className="qms-form-footer">
        <div className="text-muted qms-text-sm"><span className="text-danger">*</span> Mandatory field</div>
        <div className="qms-page-actions">
          <Button variant="outline">Save Draft</Button>
          <Button variant="primary">Register Supplier</Button>
        </div>
      </div>
    </div>
  );
};
