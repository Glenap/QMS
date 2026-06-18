import React from 'react';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { Plus, Trash2, ChevronUp } from 'lucide-react';
import './ProjectMasterForm.css';

export const ProjectMasterForm: React.FC = () => {
  return (
    <div className="qms-form-page">
      <div className="qms-page-header-block">
        <div>
          <h1 className="qms-page-title-main">Project Master</h1>
          <p className="qms-page-subtitle">Filled by: Client Admin — Set up project, towers, floors and components before inviting contractors</p>
        </div>
        <div className="qms-page-actions">
          <Button variant="outline">Save Draft</Button>
          <Button variant="primary">Submit</Button>
        </div>
      </div>

      <Card className="qms-form-section qms-border-l-blue">
        <div className="qms-section-header-toggle">
          <h3 className="qms-section-heading-plain">A · PROJECT IDENTITY</h3>
          <ChevronUp size={16} className="text-muted" />
        </div>
        <div className="qms-grid-2">
          <Input label="Project ID" required value="Auto-generated: PRJ-2024-001" readOnly disabled />
          <Input label="Project Name" required placeholder="e.g. Godrej Splendour Phase 2" />
          
          <Select label="Project Type" required options={[
            { label: 'Residential', value: 'Residential' },
            { label: 'Commercial', value: 'Commercial' },
            { label: 'Mixed-Use', value: 'Mixed-Use' },
            { label: 'Infrastructure', value: 'Infrastructure' },
          ]} />
          <Input label="Client Organisation" required placeholder="e.g. Godrej Properties Ltd" />
          
          <Input label="Client Admin Name" required />
          <Input label="Client Admin Email" required type="email" />
          
          <Input label="Client Admin Phone" required placeholder="+91" />
          <Input label="GST Number" placeholder="27AABCG1234A1Z5" />
          
          <Input label="Project Code / RERA" placeholder="P51700049510" />
        </div>
      </Card>

      <Card className="qms-form-section">
        <div className="qms-section-header-toggle">
          <h3 className="qms-section-heading-plain">B · PROJECT LOCATION</h3>
          <ChevronUp size={16} className="text-muted" />
        </div>
        <div className="qms-grid-2">
          <Input label="Address Line 1" required placeholder="Plot / Survey number" />
          <Input label="Address Line 2" placeholder="Street / Road" />
          
          <Input label="City" required />
          <Select label="State" required options={[
            { label: 'Maharashtra', value: 'MH' },
            { label: 'Karnataka', value: 'KA' },
            { label: 'Delhi', value: 'DL' },
            { label: 'Others', value: 'Others' }
          ]} />
          
          <Input label="PIN Code" required type="number" />
          <Input label="Geo-coordinates" placeholder="12.9716, 77.5946" />
          
          <Input label="Site Area (sqm)" type="number" />
        </div>
      </Card>

      <Card className="qms-form-section">
        <div className="qms-section-header-toggle">
          <h3 className="qms-section-heading-plain">C · PROJECT TIMELINE & SCOPE</h3>
          <ChevronUp size={16} className="text-muted" />
        </div>
        <div className="qms-grid-2">
          <Input label="Project Start Date" required type="date" />
          <Input label="Project End Date" required type="date" />
          
          <Input label="Total Built-up Area (sqm)" type="number" />
          <Input label="No. of Towers" required type="number" />
          
          <Input label="No. of Basements" type="number" />
          <Input label="No. of Floors (Max)" required type="number" />
          
          <Select label="Project Status" required options={[
            { label: 'Planning', value: 'Planning' },
            { label: 'Foundation', value: 'Foundation' },
            { label: 'Superstructure', value: 'Superstructure' },
            { label: 'Finishing', value: 'Finishing' },
            { label: 'Completed', value: 'Completed' }
          ]} />
        </div>
      </Card>

      <Card className="qms-form-section" padding="none">
        <div className="qms-p-4 qms-border-b">
          <div className="qms-section-header-toggle" style={{ marginBottom: 4 }}>
            <h3 className="qms-section-heading-plain">D · TOWER / BLOCK DETAILS</h3>
            <ChevronUp size={16} className="text-muted" />
          </div>
          <p className="qms-text-sm text-muted">One row per tower. Click '+ Add Tower' to add more.</p>
        </div>
        <div className="qms-table-container">
          <table className="qms-table">
            <thead>
              <tr>
                <th>Tower ID *</th>
                <th>Tower Name *</th>
                <th>Tower Type *</th>
                <th>No. Floors *</th>
                <th>Basements</th>
                <th>Floor Height</th>
                <th>Start Label</th>
                <th>Const. Start</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><Input /></td>
                <td><Input /></td>
                <td><Select options={[{label:'Residential',value:'1'}, {label:'Commercial',value:'2'}]} /></td>
                <td><Input type="number" /></td>
                <td><Input type="number" /></td>
                <td><Input type="number" /></td>
                <td><Input /></td>
                <td><Input type="date" /></td>
                <td><Button variant="ghost" icon={<Trash2 size={16} className="text-danger" />} /></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="qms-p-4">
          <Button variant="outline" className="qms-dashed-btn" icon={<Plus size={16} />}>Add Tower</Button>
        </div>
      </Card>

      <Card className="qms-form-section" padding="none">
        <div className="qms-p-4 qms-border-b">
          <div className="qms-section-header-toggle" style={{ marginBottom: 4 }}>
            <h3 className="qms-section-heading-plain">E · FLOOR / ZONE / COMPONENT MASTER</h3>
            <ChevronUp size={16} className="text-muted" />
          </div>
          <p className="qms-text-sm text-muted">One row per component. Click '+ Add Component' to add more.</p>
        </div>
        <div className="qms-table-container">
          <table className="qms-table">
            <thead>
              <tr>
                <th>Tower ID *</th>
                <th>Floor Label *</th>
                <th>Zone</th>
                <th>Grid Ref</th>
                <th>Comp Type *</th>
                <th>Comp ID *</th>
                <th>Concrete Grade *</th>
                <th>Vol m³</th>
                <th>Reinf Grade</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><Select options={[{label:'T1',value:'T1'}]} /></td>
                <td><Input /></td>
                <td><Input /></td>
                <td><Input /></td>
                <td><Select options={[{label:'Slab',value:'Slab'}, {label:'Column',value:'Column'}]} /></td>
                <td><Input /></td>
                <td><Select options={[{label:'M40',value:'M40'}, {label:'M30',value:'M30'}]} /></td>
                <td><Input type="number" /></td>
                <td><Select options={[{label:'Fe500',value:'Fe500'}]} /></td>
                <td><Button variant="ghost" icon={<Trash2 size={16} className="text-danger" />} /></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="qms-p-4">
          <Button variant="outline" className="qms-dashed-btn" icon={<Plus size={16} />}>Add Component</Button>
        </div>
      </Card>

      <Card className="qms-form-section">
        <div className="qms-section-header-toggle">
          <h3 className="qms-section-heading-plain">F · QUALITY PARAMETERS</h3>
          <ChevronUp size={16} className="text-muted" />
        </div>
        <div className="qms-grid-2">
          <Input label="Min Cube Samples" required placeholder="3 per 50m³ or part thereof" />
          <Select label="Acceptance Criteria" required options={[
            { label: 'IS 456:2000', value: 'IS 456:2000' },
            { label: 'ACI 318', value: 'ACI 318' }
          ]} />
          
          <Select label="Early Test Age (days)" required options={[{ label: '7', value: '7' }, { label: '3', value: '3' }]} />
          <Select label="Mid Test Age (days)" options={[{ label: '14', value: '14' }]} />
          
          <Select label="Final Test Age (days)" required options={[{ label: '28', value: '28' }]} />
          <Input label="Characteristic Strength %" type="number" placeholder="65" />
          
          <Input label="NCR Trigger" required placeholder="QA Manager + Project Manager + PMC" />
        </div>
      </Card>

      <div className="qms-form-footer">
        <div className="text-muted qms-text-sm"><span className="text-danger">*</span> Mandatory field</div>
        <div className="qms-page-actions">
          <Button variant="outline">Save Draft</Button>
          <Button variant="primary">Submit for Approval</Button>
        </div>
      </div>
    </div>
  );
};
