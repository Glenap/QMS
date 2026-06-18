import React, { useState } from 'react';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Check, X, Plus, QrCode } from 'lucide-react';
import './PourCardForm.css';

export const PourCardForm: React.FC = () => {
  const [activeSegment, setActiveSegment] = useState<Record<string, string>>({
    shuttering: 'yes',
    reinforcement: 'yes',
    coverBlock: 'yes',
    cleaning: 'yes',
    approval: 'approved'
  });

  const handleSegment = (key: string, val: string) => {
    setActiveSegment(prev => ({ ...prev, [key]: val }));
  };

  return (
    <div className="qms-pour-form">
      <div className="qms-pour-header">
        <div className="qms-pour-id-bar">
          <span className="text-muted">Pour ID: PC-T1-5F-SLB-20240601-001</span>
          <Badge variant="warn">In progress</Badge>
          <span className="text-muted qms-ml-auto">Last saved 2 min ago</span>
        </div>
      </div>

      <Card className="qms-form-section">
        <h3 className="qms-section-heading">A · Pour identification</h3>
        <div className="qms-grid-3">
          <Select label="Tower" required options={[
            { label: 'T1 — Tower Emerald', value: 'T1' },
            { label: 'T2', value: 'T2' }
          ]} />
          <Select label="Floor" required options={[
            { label: '5F', value: '5F' },
            { label: '6F', value: '6F' }
          ]} />
          <Select label="Zone" options={[
            { label: 'North Core', value: 'North Core' },
            { label: 'South', value: 'South' }
          ]} />
        </div>
        <div className="qms-grid-2">
          <Select label="Component type" required options={[
            { label: 'Slab', value: 'Slab' },
            { label: 'Column', value: 'Column' },
            { label: 'Beam', value: 'Beam' }
          ]} />
          <Input label="Component ID" required value="T1-5F-SLB-01" readOnly disabled />
        </div>
      </Card>

      <Card className="qms-form-section">
        <h3 className="qms-section-heading">C · Pre-pour checklist</h3>
        
        <div className="qms-checklist">
          <div className="qms-check-item">
            <span>Shuttering inspection</span>
            <div className="qms-seg-group">
              <button className={`qms-seg-btn ${activeSegment.shuttering === 'yes' ? 'qms-seg-btn--pass' : ''}`} onClick={() => handleSegment('shuttering', 'yes')}>Yes</button>
              <button className={`qms-seg-btn ${activeSegment.shuttering === 'no' ? 'qms-seg-btn--fail' : ''}`} onClick={() => handleSegment('shuttering', 'no')}>No</button>
              <button className={`qms-seg-btn ${activeSegment.shuttering === 'na' ? 'qms-seg-btn--na' : ''}`} onClick={() => handleSegment('shuttering', 'na')}>NA</button>
            </div>
          </div>
          <div className="qms-check-item">
            <span>Reinforcement inspection</span>
            <div className="qms-seg-group">
              <button className={`qms-seg-btn ${activeSegment.reinforcement === 'yes' ? 'qms-seg-btn--pass' : ''}`} onClick={() => handleSegment('reinforcement', 'yes')}>Yes</button>
              <button className={`qms-seg-btn ${activeSegment.reinforcement === 'no' ? 'qms-seg-btn--fail' : ''}`} onClick={() => handleSegment('reinforcement', 'no')}>No</button>
            </div>
          </div>
          <div className="qms-check-item">
            <span>Cover block check</span>
            <div className="qms-seg-group">
              <button className={`qms-seg-btn ${activeSegment.coverBlock === 'yes' ? 'qms-seg-btn--pass' : ''}`} onClick={() => handleSegment('coverBlock', 'yes')}>Yes</button>
              <button className={`qms-seg-btn ${activeSegment.coverBlock === 'no' ? 'qms-seg-btn--fail' : ''}`} onClick={() => handleSegment('coverBlock', 'no')}>No</button>
            </div>
          </div>
          <div className="qms-check-item">
            <span>Cleaning of formwork</span>
            <div className="qms-seg-group">
              <button className={`qms-seg-btn ${activeSegment.cleaning === 'yes' ? 'qms-seg-btn--pass' : ''}`} onClick={() => handleSegment('cleaning', 'yes')}>Yes</button>
              <button className={`qms-seg-btn ${activeSegment.cleaning === 'no' ? 'qms-seg-btn--fail' : ''}`} onClick={() => handleSegment('cleaning', 'no')}>No</button>
            </div>
          </div>
          <div className="qms-check-item qms-mt-4">
            <span className="font-medium">Pre-pour approval</span>
            <div className="qms-seg-group qms-seg-group--large">
              <button className={`qms-seg-btn ${activeSegment.approval === 'approved' ? 'qms-seg-btn--pass' : ''}`} onClick={() => handleSegment('approval', 'approved')}><Check size={14}/> Approved</button>
              <button className={`qms-seg-btn ${activeSegment.approval === 'rejected' ? 'qms-seg-btn--fail' : ''}`} onClick={() => handleSegment('approval', 'rejected')}><X size={14}/> Not approved</button>
            </div>
          </div>
        </div>
      </Card>

      <Card className="qms-form-section">
        <h3 className="qms-section-heading">E · Per-truck record</h3>
        
        <div className="qms-truck-card">
          <div className="qms-truck-head">
            <span className="font-medium text-gray-900">Truck 1 — KA-05-AB-1234</span>
            <Badge variant="pass">Transit: 35 min ✓</Badge>
          </div>
          <div className="qms-truck-grid">
            <div className="qms-truck-field">
              <div className="qms-truck-label">Batch ID</div>
              <div className="qms-truck-val">BATCH-20240601-042</div>
            </div>
            <div className="qms-truck-field">
              <div className="qms-truck-label">Load volume</div>
              <div className="qms-truck-val">7.0 m³</div>
            </div>
            <div className="qms-truck-field">
              <div className="qms-truck-label">Water added</div>
              <div className="qms-truck-val text-success">None ✓</div>
            </div>
            <div className="qms-truck-field">
              <div className="qms-truck-label">Slump</div>
              <div className="qms-truck-val">125 mm</div>
            </div>
            <div className="qms-truck-field">
              <div className="qms-truck-label">Slump result</div>
              <div className="qms-truck-val text-success">Pass</div>
            </div>
            <div className="qms-truck-field">
              <div className="qms-truck-label">Cumulative</div>
              <div className="qms-truck-val">7.0 m³</div>
            </div>
          </div>
        </div>

        <div className="qms-truck-card qms-truck-card--danger">
          <div className="qms-truck-head">
            <span className="font-medium text-gray-900">Truck 7 — KA-05-AB-1240</span>
            <Badge variant="fail">Transit: 98 min ⚠</Badge>
          </div>
          <div className="qms-truck-grid">
            <div className="qms-truck-field">
              <div className="qms-truck-label">Batch ID</div>
              <div className="qms-truck-val">BATCH-20240601-049</div>
            </div>
            <div className="qms-truck-field">
              <div className="qms-truck-label">Load volume</div>
              <div className="qms-truck-val">7.0 m³</div>
            </div>
            <div className="qms-truck-field">
              <div className="qms-truck-label">Water added</div>
              <div className="qms-truck-val text-danger">Yes — 12 L ⚠</div>
            </div>
            <div className="qms-truck-field">
              <div className="qms-truck-label">Slump</div>
              <div className="qms-truck-val">148 mm</div>
            </div>
            <div className="qms-truck-field">
              <div className="qms-truck-label">Slump result</div>
              <div className="qms-truck-val text-warning">At limit</div>
            </div>
            <div className="qms-truck-field">
              <div className="qms-truck-label">Cumulative</div>
              <div className="qms-truck-val">49.0 m³</div>
            </div>
          </div>
        </div>

        <Button variant="outline" fullWidth className="qms-dashed-btn" icon={<Plus size={16}/>}>
          Add truck
        </Button>
      </Card>

      <Card className="qms-form-section">
        <h3 className="qms-section-heading">G · Cube sampling</h3>
        <div className="qms-grid-2">
          <Input label="Cube set ID" required value="CUBE-T1-5F-20240601-001" />
          <Input label="Sampling time" required type="time" value="07:00" />
          <Select label="Lab assigned" required options={[
            { label: 'ENVTECH — LAB-2024-003', value: 'ENVTECH' }
          ]} />
          <Input label="No. of cubes cast" required type="number" value="6" />
        </div>

        <div className="qms-mt-4">
          <label className="qms-input-label">Generated cube IDs</label>
          <div className="qms-cube-tags">
            {['C001', 'C002', 'C003', 'C004', 'C005', 'C006'].map(id => (
              <span key={id} className="qms-cube-tag">{id}</span>
            ))}
          </div>
        </div>

        <Button variant="outline" size="sm" className="qms-mt-4" icon={<QrCode size={14}/>}>
          Print QR labels (6)
        </Button>
      </Card>

      <div className="qms-form-actions">
        <Button variant="outline" style={{ flex: 1 }}>Save draft</Button>
        <Button variant="primary" style={{ flex: 2 }}>Submit pour card</Button>
      </div>
    </div>
  );
};
