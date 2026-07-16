import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { Plus, Trash2, ChevronUp } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useCreateProject } from '../queries/projects';
import { getApiErrorMessage } from '../api/client';
import { num, str } from '../lib/coerce';
import type { ProjectCreate, ProjectStatus, ProjectType, TowerCreate } from '../types/master';
import './ProjectMasterForm.css';

// The form keeps every field as a string (the raw input value); the proper
// number/optional handling happens when building the ProjectCreate payload on
// submit. Cross-field tower caps are validated in onSubmit (see below) so their
// messages can be aggregated into a single banner.
const towerSchema = z.object({
  tower_code: z.string(),
  tower_name: z.string(),
  tower_type: z.string(),
  floors_total: z.string(),
  no_of_basements: z.string(),
  floor_height_m: z.string(),
  start_label: z.string(),
  construction_start_date: z.string(),
});

const schema = z.object({
  // A · Identity (org / client admin come from the authenticated user)
  project_name: z.string().min(1, 'Project name is required'),
  project_type: z.string(),
  gst_number: z.string(),
  project_code: z.string(),
  // B · Location
  address_line1: z.string(),
  address_line2: z.string(),
  city: z.string(),
  state: z.string(),
  pin_code: z.string(),
  geo_coordinates: z.string(),
  site_area_sqm: z.string(),
  // C · Timeline & scope
  start_date: z.string(),
  end_date: z.string(),
  builtup_area_sqft: z.string(),
  no_of_towers: z.string(),
  no_of_basements: z.string(),
  max_floors: z.string(),
  status: z.string(),
  registration_by: z.enum(['CONTRACTOR', 'CLIENT']),
  // D · Towers
  towers: z.array(towerSchema),
  // E · Quality parameters
  min_cube_samples: z.string(),
  acceptance_criteria: z.string(),
  early_test_age_days: z.string(),
  mid_test_age_days: z.string(),
  final_test_age_days: z.string(),
  characteristic_strength_pct: z.string(),
  ncr_trigger: z.string(),
});
type FormValues = z.infer<typeof schema>;

const EMPTY_TOWER: FormValues['towers'][number] = {
  tower_code: '',
  tower_name: '',
  tower_type: '',
  floors_total: '',
  no_of_basements: '',
  floor_height_m: '',
  start_label: '',
  construction_start_date: '',
};

const DEFAULTS: FormValues = {
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
  registration_by: 'CONTRACTOR',
  towers: [{ ...EMPTY_TOWER }],
  min_cube_samples: '',
  acceptance_criteria: 'IS 456:2000',
  early_test_age_days: '7',
  mid_test_age_days: '',
  final_test_age_days: '28',
  characteristic_strength_pct: '',
  ncr_trigger: '',
};

export const ProjectMasterForm: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const createProject = useCreateProject();

  const {
    register, handleSubmit, control, setError, clearErrors, formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: DEFAULTS });

  const { fields, append, remove } = useFieldArray({ control, name: 'towers' });

  // Project-level caps from section C, applied live to the tower rows below.
  const noOfTowers = useWatch({ control, name: 'no_of_towers' });
  const noOfBasements = useWatch({ control, name: 'no_of_basements' });
  const maxFloorsRaw = useWatch({ control, name: 'max_floors' });
  const towerValues = useWatch({ control, name: 'towers' });

  const maxFloors = num(maxFloorsRaw ?? '');
  const maxBasements = num(noOfBasements ?? '');
  const maxTowers = num(noOfTowers ?? '');
  const towerLimitReached = maxTowers != null && fields.length >= maxTowers;

  const towerFloorsError = (i: number): string | undefined => {
    const f = num(towerValues?.[i]?.floors_total ?? '');
    return maxFloors != null && f != null && f > maxFloors ? `Max ${maxFloors}` : undefined;
  };
  const towerBasementsError = (i: number): string | undefined => {
    const b = num(towerValues?.[i]?.no_of_basements ?? '');
    return maxBasements != null && b != null && b > maxBasements ? `Max ${maxBasements}` : undefined;
  };

  // Only client admins can create projects — keep others out of this form.
  if (user && user.role !== 'CLIENT_ADMIN') {
    return <Navigate to="/app/projects" replace />;
  }

  const addTower = () => {
    if (!towerLimitReached) append({ ...EMPTY_TOWER });
  };
  const removeTower = (i: number) => {
    if (fields.length > 1) remove(i);
  };

  const onSubmit = async (v: FormValues) => {
    clearErrors('root');

    // Cross-field validation: tower rows must stay within the project-level
    // caps entered above (max floors, basements, tower count). Aggregated into
    // one banner so the user sees every problem at once.
    const maxT = num(v.no_of_towers);
    const maxF = num(v.max_floors);
    const maxB = num(v.no_of_basements);
    const namedTowers = v.towers.filter((t) => t.tower_name.trim() !== '');
    const problems: string[] = [];

    if (maxT != null && namedTowers.length > maxT) {
      problems.push(`You've added ${namedTowers.length} towers but "No. of Towers" is set to ${maxT}.`);
    }
    namedTowers.forEach((t) => {
      const label = t.tower_name.trim();
      const floors = num(t.floors_total);
      if (maxF != null && floors != null && floors > maxF) {
        problems.push(`Tower "${label}" has ${floors} floors, above the project max of ${maxF}.`);
      }
      const basements = num(t.no_of_basements);
      if (maxB != null && basements != null && basements > maxB) {
        problems.push(`Tower "${label}" has ${basements} basements, above the project max of ${maxB}.`);
      }
    });

    if (problems.length > 0) {
      setError('root', { message: problems.join(' ') });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const towersPayload: TowerCreate[] = v.towers
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
      project_name: v.project_name.trim(),
      project_type: v.project_type ? (v.project_type as ProjectType) : undefined,
      project_code: str(v.project_code),
      status: v.status as ProjectStatus,
      registration_by: v.registration_by,
      gst_number: str(v.gst_number),
      address_line1: str(v.address_line1),
      address_line2: str(v.address_line2),
      city: str(v.city),
      state: str(v.state),
      pin_code: str(v.pin_code),
      geo_coordinates: str(v.geo_coordinates),
      site_area_sqm: num(v.site_area_sqm),
      start_date: str(v.start_date),
      end_date: str(v.end_date),
      builtup_area_sqft: num(v.builtup_area_sqft),
      no_of_towers: num(v.no_of_towers),
      no_of_basements: num(v.no_of_basements),
      max_floors: num(v.max_floors),
      acceptance_criteria: str(v.acceptance_criteria),
      min_cube_samples: str(v.min_cube_samples),
      early_test_age_days: num(v.early_test_age_days),
      mid_test_age_days: num(v.mid_test_age_days),
      final_test_age_days: num(v.final_test_age_days),
      characteristic_strength_pct: num(v.characteristic_strength_pct),
      ncr_trigger: str(v.ncr_trigger),
      towers: towersPayload,
    };

    try {
      const created = await createProject.mutateAsync(payload);
      // Created — hand off to the projects list, which shows the new project
      // (and a success banner) rather than leaving a blanked form behind.
      navigate('/app/projects', { state: { created: created.project_name } });
    } catch (err) {
      setError('root', { message: getApiErrorMessage(err, 'Unable to create project. Please try again.') });
    }
  };

  const alertStyle: React.CSSProperties = {
    padding: '12px 16px',
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 14,
  };

  return (
    <form className="qms-form-page" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="qms-page-header-block">
        <div>
          <h1 className="qms-page-title-main">New Project</h1>
          <p className="qms-page-subtitle">Set up the project, its towers and quality parameters. You'll add contractors and team after it's created.</p>
        </div>
      </div>

      {errors.root && (
        <div style={{ ...alertStyle, background: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5' }}>
          {errors.root.message}
        </div>
      )}

      <Card className="qms-form-section qms-border-l-blue">
        <div className="qms-section-header-toggle">
          <h3 className="qms-section-heading-plain">A · PROJECT IDENTITY</h3>
          <ChevronUp size={16} className="text-muted" />
        </div>
        <div className="qms-grid-2">
          <Input label="Project ID" value="Auto-generated on submit" readOnly disabled />
          <Input label="Project Name" required placeholder="e.g. Godrej Splendour Phase 2" error={errors.project_name?.message} {...register('project_name')} />

          <Select label="Project Type" {...register('project_type')} options={[
            { label: 'Select type…', value: '' },
            { label: 'Residential', value: 'RESIDENTIAL' },
            { label: 'Commercial', value: 'COMMERCIAL' },
            { label: 'Mixed-Use', value: 'MIXED_USE' },
            { label: 'Infrastructure', value: 'INFRASTRUCTURE' },
          ]} />
          <Input label="Client Organisation" placeholder="Derived from your client account" disabled />

          <Input label="Client Admin Name" placeholder="Derived from your account" disabled />
          <Input label="Client Admin Email" type="email" placeholder="Derived from your account" disabled />

          <Input label="GST Number" placeholder="27AABCG1234A1Z5" {...register('gst_number')} />
          <Input label="Project Code / RERA" placeholder="P51700049510" {...register('project_code')} />

          <Select label="RMC & labs registered by" {...register('registration_by')} options={[
            { label: 'Contractor (default)', value: 'CONTRACTOR' },
            { label: 'Client — you register, contractor approves', value: 'CLIENT' },
          ]} />
        </div>
      </Card>

      <Card className="qms-form-section">
        <div className="qms-section-header-toggle">
          <h3 className="qms-section-heading-plain">B · PROJECT LOCATION</h3>
          <ChevronUp size={16} className="text-muted" />
        </div>
        <div className="qms-grid-2">
          <Input label="Address Line 1" placeholder="Plot / Survey number" {...register('address_line1')} />
          <Input label="Address Line 2" placeholder="Street / Road" {...register('address_line2')} />

          <Input label="City" {...register('city')} />
          <Select label="State" {...register('state')} options={[
            { label: 'Select state…', value: '' },
            { label: 'Maharashtra', value: 'MH' },
            { label: 'Karnataka', value: 'KA' },
            { label: 'Delhi', value: 'DL' },
            { label: 'Others', value: 'Others' },
          ]} />

          <Input label="PIN Code" type="number" {...register('pin_code')} />
          <Input label="Geo-coordinates" placeholder="12.9716, 77.5946" {...register('geo_coordinates')} />

          <Input label="Site Area (sqm)" type="number" {...register('site_area_sqm')} />
        </div>
      </Card>

      <Card className="qms-form-section">
        <div className="qms-section-header-toggle">
          <h3 className="qms-section-heading-plain">C · PROJECT TIMELINE & SCOPE</h3>
          <ChevronUp size={16} className="text-muted" />
        </div>
        <div className="qms-grid-2">
          <Input label="Project Start Date" type="date" {...register('start_date')} />
          <Input label="Project End Date" type="date" {...register('end_date')} />

          <Input label="Total Built-up Area (sqft)" type="number" {...register('builtup_area_sqft')} />
          <Input label="No. of Towers" type="number" {...register('no_of_towers')} />

          <Input label="No. of Basements (Max)" type="number" {...register('no_of_basements')} />
          <Input label="No. of Floors (Max)" type="number" {...register('max_floors')} />

          <Select label="Project Status" required {...register('status')} options={[
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
              {fields.map((field, i) => (
                <tr key={field.id}>
                  <td><Input {...register(`towers.${i}.tower_code`)} /></td>
                  <td><Input {...register(`towers.${i}.tower_name`)} /></td>
                  <td><Select {...register(`towers.${i}.tower_type`)} options={[
                    { label: '—', value: '' },
                    { label: 'Residential', value: 'Residential' },
                    { label: 'Commercial', value: 'Commercial' },
                  ]} /></td>
                  <td><Input type="number" min={0} max={maxFloors} error={towerFloorsError(i)} {...register(`towers.${i}.floors_total`)} /></td>
                  <td><Input type="number" min={0} max={maxBasements} error={towerBasementsError(i)} {...register(`towers.${i}.no_of_basements`)} /></td>
                  <td><Input type="number" {...register(`towers.${i}.floor_height_m`)} /></td>
                  <td><Input {...register(`towers.${i}.start_label`)} /></td>
                  <td><Input type="date" {...register(`towers.${i}.construction_start_date`)} /></td>
                  <td><Button type="button" variant="ghost" onClick={() => removeTower(i)} icon={<Trash2 size={16} className="text-danger" />} /></td>
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
          <Input label="Min Cube Samples" placeholder="3 per 50m³ or part thereof" {...register('min_cube_samples')} />
          <Select label="Acceptance Criteria" {...register('acceptance_criteria')} options={[
            { label: 'IS 456:2000', value: 'IS 456:2000' },
            { label: 'ACI 318', value: 'ACI 318' }
          ]} />

          <Select label="Early Test Age (days)" {...register('early_test_age_days')} options={[{ label: '7', value: '7' }, { label: '3', value: '3' }]} />
          <Select label="Mid Test Age (days)" {...register('mid_test_age_days')} options={[{ label: '—', value: '' }, { label: '14', value: '14' }]} />

          <Select label="Final Test Age (days)" {...register('final_test_age_days')} options={[{ label: '28', value: '28' }]} />
          <Input label="Characteristic Strength %" type="number" placeholder="65" {...register('characteristic_strength_pct')} />

          <Input label="NCR Trigger" placeholder="QA Manager + Project Manager + PMC" {...register('ncr_trigger')} />
        </div>
      </Card>

      <div className="qms-form-footer">
        <div className="text-muted qms-text-sm"><span className="text-danger">*</span> Mandatory field</div>
        <Button type="submit" variant="primary" disabled={createProject.isPending}>
          {createProject.isPending ? 'Creating…' : 'Create Project'}
        </Button>
      </div>
    </form>
  );
};
