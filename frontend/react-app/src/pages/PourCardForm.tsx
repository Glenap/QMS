// Raise a pour card — captures the pour identification, grade, supplier and
// planned volume, then creates a PLANNED pour (QUALITY_ENGINEER only).

import React, { useEffect, useMemo } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { ErrorBox } from '../components/ui/ErrorBox';
import { useAuth } from '../hooks/useAuth';
import { useProject } from '../components/layout/ProjectLayout';
import { getApiErrorMessage } from '../api/client';
import { toast } from '../lib/toast';
import { useProjectTowers, useFloors } from '../queries/floors';
import { useGrades, useComponents } from '../queries/catalog';
import { useSuppliers } from '../queries/suppliers';
import { useCreatePour } from '../queries/pours';

const COMPONENT_LABEL: Record<string, string> = {
  COLUMN: 'Column', SLAB: 'Slab', BEAM: 'Beam', RAFT: 'Raft',
  SHEAR_WALL: 'Shear wall', STAIRCASE: 'Staircase', LIFT_CORE: 'Lift core', FOUNDATION: 'Foundation',
};

const schema = z.object({
  tower_id: z.string().min(1, 'Select a tower'),
  floor_id: z.string().min(1, 'Select a floor'),
  component_id: z.string().min(1, 'Select a component'),
  grade_id: z.string().min(1, 'Select a grade'),
  supplier_horizontal_id: z.string().min(1, 'Select a supplier'),
  pour_date: z.string().min(1, 'Pick a pour date'),
  pour_reference: z.string(),
  volume_cum: z.string(),
  sub_contractor_name: z.string(),
});
type FormValues = z.infer<typeof schema>;

export const PourCardForm: React.FC = () => {
  const { user } = useAuth();
  const { project } = useProject();
  const navigate = useNavigate();
  const pid = project.project_id;

  const { data: towers = [], error: towersError } = useProjectTowers(pid);
  const { data: components = [] } = useComponents();
  const { data: grades = [] } = useGrades();
  const { data: suppliers = [] } = useSuppliers(pid);
  const createPour = useCreatePour(pid);

  const {
    register, handleSubmit, control, setValue, formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      tower_id: '', floor_id: '', component_id: '', grade_id: '',
      supplier_horizontal_id: '', pour_date: '', pour_reference: '', volume_cum: '', sub_contractor_name: '',
    },
  });

  const towerId = useWatch({ control, name: 'tower_id' });
  const { data: floors = [] } = useFloors(pid, towerId ? Number(towerId) : null);

  // A contractor only works on their allotted towers — restrict the picker.
  const visibleTowers = useMemo(() => {
    const scope = project.assigned_scope;
    if (!scope || scope === 'Entire project') return towers;
    const allowed = new Set(scope.split(',').map((s) => s.trim()));
    return towers.filter((t) => allowed.has(t.tower_name));
  }, [towers, project.assigned_scope]);

  // Single allotted tower → auto-fill and lock (it's passed on, not a choice).
  const towerLocked = visibleTowers.length === 1;
  useEffect(() => {
    if (towerLocked && !towerId) setValue('tower_id', String(visibleTowers[0].tower_id));
  }, [towerLocked, towerId, visibleTowers, setValue]);

  // Reset the floor whenever the tower changes (floors are tower-scoped).
  useEffect(() => { setValue('floor_id', ''); }, [towerId, setValue]);

  // Pour cards are raised by the Quality Engineer only.
  if (user && user.role !== 'QUALITY_ENGINEER') {
    return <Navigate to={`/app/projects/${pid}`} replace />;
  }

  const onSubmit = async (v: FormValues) => {
    try {
      await createPour.mutateAsync({
        tower_id: Number(v.tower_id),
        floor_id: Number(v.floor_id),
        component_id: Number(v.component_id),
        grade_id: Number(v.grade_id),
        supplier_horizontal_id: Number(v.supplier_horizontal_id),
        pour_date: v.pour_date,
        pour_reference: v.pour_reference.trim() || null,
        volume_cum: v.volume_cum.trim() ? Number(v.volume_cum) : null,
        sub_contractor_name: v.sub_contractor_name.trim() || null,
      });
      toast.success('Pour card created.');
      navigate(`/app/projects/${pid}/pours`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Unable to create pour.'));
    }
  };

  return (
    <form className="qms-pour-form" onSubmit={handleSubmit(onSubmit)}>
      {towersError && <ErrorBox>{getApiErrorMessage(towersError, 'Unable to load reference data.')}</ErrorBox>}

      <Card className="qms-form-section">
        <h3 className="qms-section-heading">A · Pour identification</h3>
        <div className="qms-grid-3">
          <Select
            label="Tower"
            required
            disabled={towerLocked}
            error={errors.tower_id?.message}
            {...register('tower_id')}
            options={
              towerLocked
                ? visibleTowers.map((t) => ({ label: t.tower_name, value: t.tower_id }))
                : [
                    { label: visibleTowers.length ? 'Select tower…' : 'No towers assigned to you', value: '' },
                    ...visibleTowers.map((t) => ({ label: t.tower_name, value: t.tower_id })),
                  ]
            }
          />
          <Select label="Floor" required error={errors.floor_id?.message} {...register('floor_id')} options={[
            { label: !towerId ? 'Pick a tower first' : floors.length ? 'Select floor…' : 'No floors — add them in Setup › Floors', value: '' },
            ...floors.map((f) => ({ label: f.floor_label, value: f.floor_id })),
          ]} />
          <Select label="Component type" required error={errors.component_id?.message} {...register('component_id')} options={[
            { label: 'Select component…', value: '' },
            ...components.map((c) => ({ label: COMPONENT_LABEL[c.component_type] ?? c.component_type, value: c.component_id })),
          ]} />
        </div>
      </Card>

      <Card className="qms-form-section">
        <h3 className="qms-section-heading">B · Concrete & supply</h3>
        <div className="qms-grid-3">
          <Select label="Grade" required error={errors.grade_id?.message} {...register('grade_id')} options={[
            { label: 'Select grade…', value: '' },
            ...grades.map((g) => ({ label: g.grade_name, value: g.grade_id })),
          ]} />
          <Select label="RMC supplier" required error={errors.supplier_horizontal_id?.message} {...register('supplier_horizontal_id')} options={[
            { label: suppliers.length ? 'Select supplier…' : 'No suppliers yet', value: '' },
            ...suppliers.map((s) => ({ label: s.supplier_name, value: s.supplier_id })),
          ]} />
          <Input label="Sub-contractor" placeholder="Optional" {...register('sub_contractor_name')} />
        </div>
      </Card>

      <Card className="qms-form-section">
        <h3 className="qms-section-heading">C · Pour details</h3>
        <div className="qms-grid-3">
          <Input label="Pour date" type="date" required error={errors.pour_date?.message} {...register('pour_date')} />
          <Input label="Pour reference" placeholder="e.g. PC-T1-5F-001" {...register('pour_reference')} />
          <Input label="Planned volume (m³)" type="number" step="0.1" {...register('volume_cum')} />
        </div>
        <p className="qms-text-sm text-muted qms-mt-8">
          Pre-pour checklist, per-truck logging and cube sampling are added in later phases.
        </p>
      </Card>

      <div className="qms-form-actions">
        <Button type="button" variant="outline" className="qms-flex-1" onClick={() => navigate(`/app/projects/${pid}/pours`)}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" className="qms-flex-2" disabled={createPour.isPending}>
          {createPour.isPending ? 'Creating…' : 'Create pour card'}
        </Button>
      </div>
    </form>
  );
};
