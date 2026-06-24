import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { Plus, Trash2, ChevronUp } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { projectsApi } from '../api/projects';
import { getApiErrorMessage } from '../api/client';
import type { ProjectCreate, ProjectStatus, ProjectType, TowerCreate } from '../types/master';
import './ProjectMasterForm.css';

// String-valued mirror of the project fields this form collects. Converted to a
// ProjectCreate payload (with proper number/optional handling) on submit.
interface ProjectFormState {
  // A · Identity (org / client admin come from the authenticated user)
  project_name: string;
  project_type: string; // '' | ProjectType
  gst_number: string;
  project_code: string;
  // B · Location
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  pin_code: string;
  geo_coordinates: string;
  site_area_sqm: string;
  // C · Timeline & scope
  start_date: string;
  end_date: string;
  builtup_area_sqft: string;
  no_of_towers: string;
  no_of_basements: string;
  max_floors: string;
  status: string; // ProjectStatus
  // F · Quality parameters
  min_cube_samples: string;
  acceptance_criteria: string;
  early_test_age_days: string;
  mid_test_age_days: string;
  final_test_age_days: string;
  characteristic_strength_pct: string;
  ncr_trigger: string;
}

// String-valued mirror of a TowerCreate row.
interface TowerRowState {
  _id: string;
  tower_code: string;
  tower_name: string;
  tower_type: string;
  floors_total: string;
  no_of_basements: string;
  floor_height_m: string;
  start_label: string;
  construction_start_date: string;
}

const INITIAL: ProjectFormState = {
  project_name: '',
  project_type: '',
  gst_number: '',
  project_code: '',
  address_line1: '',
  address_line2: '',
  city: '',
  state: '',
  pin_code: '',
  geo_coordinates: '',
  site_area_sqm: '',
  start_date: '',
  end_date: '',
  builtup_area_sqft: '',
  no_of_towers: '',
  no_of_basements: '',
  max_floors: '',
  status: 'ACTIVE',
  min_cube_samples: '',
  acceptance_criteria: 'IS 456:2000',
  early_test_age_days: '7',
  mid_test_age_days: '',
  final_test_age_days: '28',
  characteristic_strength_pct: '',
  ncr_trigger: '',
};

const newTowerRow = (): TowerRowState => ({
  _id: crypto.randomUUID(),
  tower_code: '',
  tower_name: '',
  tower_type: '',
  floors_total: '',
  no_of_basements: '',
  floor_height_m: '',
  start_label: '',
  construction_start_date: '',
});

// '' → undefined so optional fields are omitted from the JSON payload.
const str = (v: string): string | undefined => (v.trim() === '' ? undefined : v.trim());
const num = (v: string): number | undefined => {
  const t = v.trim();
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isNaN(n) ? undefined : n;
};

export const ProjectMasterForm: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<ProjectFormState>(INITIAL);
  const [towers, setTowers] = useState<TowerRowState[]>([newTowerRow()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Only client admins can create projects — keep others out of this form.
  if (user && user.role !== 'CLIENT_ADMIN') {
    return <Navigate to="/app/projects" replace />;
  }

  const update =
    (field: keyof ProjectFormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const updateTower =
    (id: string, field: keyof Omit<TowerRowState, '_id'>) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setTowers((prev) =>
        prev.map((t) => (t._id === id ? { ...t, [field]: e.target.value } : t))
      );

  // Project-level caps from section C, applied live to the tower rows below.
  const maxFloors = num(form.max_floors);
  const maxBasements = num(form.no_of_basements);
  const maxTowers = num(form.no_of_towers);
  const towerLimitReached = maxTowers != null && towers.length >= maxTowers;

  const towerFloorsError = (t: TowerRowState): string | undefined => {
    const f = num(t.floors_total);
    return maxFloors != null && f != null && f > maxFloors ? `Max ${maxFloors}` : undefined;
  };
  const towerBasementsError = (t: TowerRowState): string | undefined => {
    const b = num(t.no_of_basements);
    return maxBasements != null && b != null && b > maxBasements ? `Max ${maxBasements}` : undefined;
  };

  const addTower = () =>
    setTowers((prev) => (towerLimitReached ? prev : [...prev, newTowerRow()]));
  const removeTower = (id: string) =>
    setTowers((prev) => (prev.length === 1 ? prev : prev.filter((t) => t._id !== id)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Cross-field validation: tower rows must stay within the project-level
    // caps entered above (max floors, basements, tower count).
    const namedTowers = towers.filter((t) => t.tower_name.trim() !== '');
    const problems: string[] = [];

    if (maxTowers != null && namedTowers.length > maxTowers) {
      problems.push(`You've added ${namedTowers.length} towers but "No. of Towers" is set to ${maxTowers}.`);
    }
    namedTowers.forEach((t) => {
      const label = t.tower_name.trim();
      const floors = num(t.floors_total);
      if (maxFloors != null && floors != null && floors > maxFloors) {
        problems.push(`Tower "${label}" has ${floors} floors, above the project max of ${maxFloors}.`);
      }
      const basements = num(t.no_of_basements);
      if (maxBasements != null && basements != null && basements > maxBasements) {
        problems.push(`Tower "${label}" has ${basements} basements, above the project max of ${maxBasements}.`);
      }
    });

    if (problems.length > 0) {
      setError(problems.join(' '));
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSubmitting(true);

    const towersPayload: TowerCreate[] = towers
      .filter((t) => t.tower_name.trim() !== '')
      .map((t) => ({
        tower_name: t.tower_name.trim(),
        tower_code: str(t.tower_code),
        tower_type: str(t.tower_type),
        floors_total: num(t.floors_total),
        no_of_basements: num(t.no_of_basements),
        floor_height_m: num(t.floor_height_m),
        start_label: str(t.start_label),
        construction_start_date: str(t.construction_start_date),
      }));

    const payload: ProjectCreate = {
      project_name: form.project_name.trim(),
      project_type: form.project_type ? (form.project_type as ProjectType) : undefined,
      project_code: str(form.project_code),
      status: form.status as ProjectStatus,
      gst_number: str(form.gst_number),
      address_line1: str(form.address_line1),
      address_line2: str(form.address_line2),
      city: str(form.city),
      state: str(form.state),
      pin_code: str(form.pin_code),
      geo_coordinates: str(form.geo_coordinates),
      site_area_sqm: num(form.site_area_sqm),
      start_date: str(form.start_date),
      end_date: str(form.end_date),
      builtup_area_sqft: num(form.builtup_area_sqft),
      no_of_towers: num(form.no_of_towers),
      no_of_basements: num(form.no_of_basements),
      max_floors: num(form.max_floors),
      acceptance_criteria: str(form.acceptance_criteria),
      min_cube_samples: str(form.min_cube_samples),
      early_test_age_days: num(form.early_test_age_days),
      mid_test_age_days: num(form.mid_test_age_days),
      final_test_age_days: num(form.final_test_age_days),
      characteristic_strength_pct: num(form.characteristic_strength_pct),
      ncr_trigger: str(form.ncr_trigger),
      towers: towersPayload,
    };

    try {
      const created = await projectsApi.create(payload);
      // Created — hand off to the projects list, which shows the new project
      // (and a success banner) rather than leaving a blanked form behind.
      navigate('/app/projects', { state: { created: created.project_name } });
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to create project. Please try again.'));
      setSubmitting(false);
    }
  };

  const alertStyle: React.CSSProperties = {
    padding: '12px 16px',
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 14,
  };

  return (
    <form className="qms-form-page" onSubmit={handleSubmit}>
      <div className="qms-page-header-block">
        <div>
          <h1 className="qms-page-title-main">New Project</h1>
          <p className="qms-page-subtitle">Set up the project, its towers and quality parameters. You'll add contractors and team after it's created.</p>
        </div>
      </div>

      {error && (
        <div style={{ ...alertStyle, background: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5' }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ ...alertStyle, background: '#DCFCE7', color: '#166534', border: '1px solid #86EFAC' }}>
          {success}
        </div>
      )}

      <Card className="qms-form-section qms-border-l-blue">
        <div className="qms-section-header-toggle">
          <h3 className="qms-section-heading-plain">A · PROJECT IDENTITY</h3>
          <ChevronUp size={16} className="text-muted" />
        </div>
        <div className="qms-grid-2">
          <Input label="Project ID" value="Auto-generated on submit" readOnly disabled />
          <Input label="Project Name" required placeholder="e.g. Godrej Splendour Phase 2" value={form.project_name} onChange={update('project_name')} />

          <Select label="Project Type" value={form.project_type} onChange={update('project_type')} options={[
            { label: 'Select type…', value: '' },
            { label: 'Residential', value: 'RESIDENTIAL' },
            { label: 'Commercial', value: 'COMMERCIAL' },
            { label: 'Mixed-Use', value: 'MIXED_USE' },
            { label: 'Infrastructure', value: 'INFRASTRUCTURE' },
          ]} />
          <Input label="Client Organisation" placeholder="Derived from your client account" disabled />

          <Input label="Client Admin Name" placeholder="Derived from your account" disabled />
          <Input label="Client Admin Email" type="email" placeholder="Derived from your account" disabled />

          <Input label="GST Number" placeholder="27AABCG1234A1Z5" value={form.gst_number} onChange={update('gst_number')} />
          <Input label="Project Code / RERA" placeholder="P51700049510" value={form.project_code} onChange={update('project_code')} />
        </div>
      </Card>

      <Card className="qms-form-section">
        <div className="qms-section-header-toggle">
          <h3 className="qms-section-heading-plain">B · PROJECT LOCATION</h3>
          <ChevronUp size={16} className="text-muted" />
        </div>
        <div className="qms-grid-2">
          <Input label="Address Line 1" placeholder="Plot / Survey number" value={form.address_line1} onChange={update('address_line1')} />
          <Input label="Address Line 2" placeholder="Street / Road" value={form.address_line2} onChange={update('address_line2')} />

          <Input label="City" value={form.city} onChange={update('city')} />
          <Select label="State" value={form.state} onChange={update('state')} options={[
            { label: 'Select state…', value: '' },
            { label: 'Maharashtra', value: 'MH' },
            { label: 'Karnataka', value: 'KA' },
            { label: 'Delhi', value: 'DL' },
            { label: 'Others', value: 'Others' },
          ]} />

          <Input label="PIN Code" type="number" value={form.pin_code} onChange={update('pin_code')} />
          <Input label="Geo-coordinates" placeholder="12.9716, 77.5946" value={form.geo_coordinates} onChange={update('geo_coordinates')} />

          <Input label="Site Area (sqm)" type="number" value={form.site_area_sqm} onChange={update('site_area_sqm')} />
        </div>
      </Card>

      <Card className="qms-form-section">
        <div className="qms-section-header-toggle">
          <h3 className="qms-section-heading-plain">C · PROJECT TIMELINE & SCOPE</h3>
          <ChevronUp size={16} className="text-muted" />
        </div>
        <div className="qms-grid-2">
          <Input label="Project Start Date" type="date" value={form.start_date} onChange={update('start_date')} />
          <Input label="Project End Date" type="date" value={form.end_date} onChange={update('end_date')} />

          <Input label="Total Built-up Area (sqft)" type="number" value={form.builtup_area_sqft} onChange={update('builtup_area_sqft')} />
          <Input label="No. of Towers" type="number" value={form.no_of_towers} onChange={update('no_of_towers')} />

          <Input label="No. of Basements (Max)" type="number" value={form.no_of_basements} onChange={update('no_of_basements')} />
          <Input label="No. of Floors (Max)" type="number" value={form.max_floors} onChange={update('max_floors')} />

          <Select label="Project Status" required value={form.status} onChange={update('status')} options={[
            { label: 'Active', value: 'ACTIVE' },
            { label: 'On Hold', value: 'ON_HOLD' },
            { label: 'Completed', value: 'COMPLETED' },
          ]} />
        </div>
      </Card>

      <Card className="qms-form-section" padding="none">
        <div className="qms-p-4 qms-border-b">
          <div className="qms-section-header-toggle" style={{ marginBottom: 4 }}>
            <h3 className="qms-section-heading-plain">D · TOWER / BLOCK DETAILS</h3>
            <ChevronUp size={16} className="text-muted" />
          </div>
          <p className="qms-text-sm text-muted">One row per tower. Rows with a Tower Name are saved with the project.</p>
        </div>
        <div className="qms-table-container">
          <table className="qms-table">
            <thead>
              <tr>
                <th>Tower ID</th>
                <th>Tower Name *</th>
                <th>Tower Type</th>
                <th>No. Floors</th>
                <th>Basements</th>
                <th>Floor Height</th>
                <th>Start Label</th>
                <th>Const. Start</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {towers.map((t) => (
                <tr key={t._id}>
                  <td><Input value={t.tower_code} onChange={updateTower(t._id, 'tower_code')} /></td>
                  <td><Input value={t.tower_name} onChange={updateTower(t._id, 'tower_name')} /></td>
                  <td><Select value={t.tower_type} onChange={updateTower(t._id, 'tower_type')} options={[
                    { label: '—', value: '' },
                    { label: 'Residential', value: 'Residential' },
                    { label: 'Commercial', value: 'Commercial' },
                  ]} /></td>
                  <td><Input type="number" min={0} max={maxFloors} value={t.floors_total} onChange={updateTower(t._id, 'floors_total')} error={towerFloorsError(t)} /></td>
                  <td><Input type="number" min={0} max={maxBasements} value={t.no_of_basements} onChange={updateTower(t._id, 'no_of_basements')} error={towerBasementsError(t)} /></td>
                  <td><Input type="number" value={t.floor_height_m} onChange={updateTower(t._id, 'floor_height_m')} /></td>
                  <td><Input value={t.start_label} onChange={updateTower(t._id, 'start_label')} /></td>
                  <td><Input type="date" value={t.construction_start_date} onChange={updateTower(t._id, 'construction_start_date')} /></td>
                  <td><Button type="button" variant="ghost" onClick={() => removeTower(t._id)} icon={<Trash2 size={16} className="text-danger" />} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="qms-p-4" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Button type="button" variant="outline" className="qms-dashed-btn" icon={<Plus size={16} />} onClick={addTower} disabled={towerLimitReached}>Add Tower</Button>
          {towerLimitReached && (
            <span className="qms-text-sm text-muted">Limit of {maxTowers} tower{maxTowers === 1 ? '' : 's'} reached (set in Timeline &amp; Scope).</span>
          )}
        </div>
      </Card>

      <Card className="qms-form-section">
        <div className="qms-section-header-toggle">
          <h3 className="qms-section-heading-plain">E · QUALITY PARAMETERS</h3>
          <ChevronUp size={16} className="text-muted" />
        </div>
        <div className="qms-grid-2">
          <Input label="Min Cube Samples" placeholder="3 per 50m³ or part thereof" value={form.min_cube_samples} onChange={update('min_cube_samples')} />
          <Select label="Acceptance Criteria" value={form.acceptance_criteria} onChange={update('acceptance_criteria')} options={[
            { label: 'IS 456:2000', value: 'IS 456:2000' },
            { label: 'ACI 318', value: 'ACI 318' }
          ]} />

          <Select label="Early Test Age (days)" value={form.early_test_age_days} onChange={update('early_test_age_days')} options={[{ label: '7', value: '7' }, { label: '3', value: '3' }]} />
          <Select label="Mid Test Age (days)" value={form.mid_test_age_days} onChange={update('mid_test_age_days')} options={[{ label: '—', value: '' }, { label: '14', value: '14' }]} />

          <Select label="Final Test Age (days)" value={form.final_test_age_days} onChange={update('final_test_age_days')} options={[{ label: '28', value: '28' }]} />
          <Input label="Characteristic Strength %" type="number" placeholder="65" value={form.characteristic_strength_pct} onChange={update('characteristic_strength_pct')} />

          <Input label="NCR Trigger" placeholder="QA Manager + Project Manager + PMC" value={form.ncr_trigger} onChange={update('ncr_trigger')} />
        </div>
      </Card>

      <div className="qms-form-footer">
        <div className="text-muted qms-text-sm"><span className="text-danger">*</span> Mandatory field</div>
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create Project'}
        </Button>
      </div>
    </form>
  );
};
