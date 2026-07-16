// Record a pour from an accepted delivery — grade, supplier and volume come from
// the dispatch; the QE supplies the placement location + metadata. One delivery
// yields one pour (QUALITY_ENGINEER only).

import React, { useEffect, useMemo } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { ErrorBox } from '../../components/ui/ErrorBox';
import { useAuth } from '../../hooks/useAuth';
import { useProject } from '../../components/layout/ProjectLayout';
import { getApiErrorMessage } from '../../api/client';
import { toast } from '../../lib/toast';
import { useProjectTowers, useFloors } from '../../queries/floors';
import { useComponents } from '../../queries/catalog';
import { useDispatches } from '../../queries/dispatches';
import { useCreatePour } from '../../queries/pours';

const COMPONENT_LABEL: Record<string, string> = {
  COLUMN: 'Column', SLAB: 'Slab', BEAM: 'Beam', RAFT: 'Raft',
  SHEAR_WALL: 'Shear wall', STAIRCASE: 'Staircase', LIFT_CORE: 'Lift core', FOUNDATION: 'Foundation',
};

const schema = z.object({
  tower_id: z.string().min(1, 'Select a tower'),
  floor_id: z.string().min(1, 'Select a floor'),
  component_id: z.string().min(1, 'Select a component'),
  pour_date: z.string().min(1, 'Pick a pour date'),
  pour_reference: z.string(),
  sub_contractor_name: z.string(),
});
type FormValues = z.infer<typeof schema>;

const today = () => new Date().toISOString().slice(0, 10);

export const PourCardForm: React.FC = () => {
  const { user } = useAuth();
  const { project } = useProject();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const pid = project.project_id;

  const dispatchId = Number(searchParams.get('dispatch')) || null;
  const { data: dispatches = [], isPending: dispatchesLoading } = useDispatches(pid);
  // The pour records this accepted delivery; grade/supplier/volume come from it.
  const dispatch = useMemo(
    () => dispatches.find((d) => d.dispatch_id === dispatchId) ?? null,
    [dispatches, dispatchId],
  );
  const eligible = dispatch?.truck?.status === 'ACCEPTED' && dispatch.pour_id == null;

  const { data: towers = [], error: towersError } = useProjectTowers(pid);
  const { data: components = [] } = useComponents();
  const createPour = useCreatePour(pid);

  const {
    register, handleSubmit, control, setValue, formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      tower_id: '', floor_id: '', component_id: '',
      pour_date: today(), pour_reference: '', sub_contractor_name: '',
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

  // Pours are recorded by the Quality Engineer only.
  if (user && user.role !== 'QUALITY_ENGINEER') {
    return <Navigate to={`/app/projects/${pid}`} replace />;
  }

  if (!dispatchId || (!dispatchesLoading && !eligible)) {
    return (
      <Card className="qms-form-section">
        <h3 className="qms-section-heading">Record a pour</h3>
        <p className="qms-page-subtitle">
          A pour is recorded from an <strong>accepted delivery</strong>. Open the
          Dispatches page and use “Record pour” on an accepted truck.
        </p>
        <div className="qms-form-actions">
          <Button variant="primary" onClick={() => navigate(`/app/projects/${pid}/dispatches`)}>
            Go to dispatches
          </Button>
        </div>
      </Card>
    );
  }

  const onSubmit = async (v: FormValues) => {
    if (!dispatch) return;
    try {
      await createPour.mutateAsync({
        dispatch_id: dispatch.dispatch_id,
        tower_id: Number(v.tower_id),
        floor_id: Number(v.floor_id),
        component_id: Number(v.component_id),
        pour_date: v.pour_date,
        pour_reference: v.pour_reference.trim() || null,
        sub_contractor_name: v.sub_contractor_name.trim() || null,
      });
      toast.success('Pour recorded.');
      navigate(`/app/projects/${pid}/pours`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Unable to record pour.'));
    }
  };

  return (
    <form className="qms-pour-form" onSubmit={handleSubmit(onSubmit)} noValidate>
      {towersError && <ErrorBox>{getApiErrorMessage(towersError, 'Unable to load reference data.')}</ErrorBox>}

      <Card className="qms-form-section">
        <h3 className="qms-section-heading">Delivery</h3>
        <div className="qms-grid-3">
          <Input label="Grade" value={dispatch?.grade_name ?? '—'} disabled />
          <Input label="RMC supplier" value={dispatch?.supplier_name ?? '—'} disabled />
          <Input
            label="Volume delivered (m³)"
            value={dispatch?.volume_received_cum != null ? String(dispatch.volume_received_cum) : '—'}
            disabled
          />
        </div>
        <p className="qms-text-sm text-muted qms-mt-8">
          Grade, supplier and volume are taken from the accepted delivery.
        </p>
      </Card>

      <Card className="qms-form-section">
        <h3 className="qms-section-heading">Placement location</h3>
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
        <h3 className="qms-section-heading">Pour details</h3>
        <div className="qms-grid-3">
          <Input label="Pour date" type="date" required error={errors.pour_date?.message} {...register('pour_date')} />
          <Input label="Pour reference" placeholder="e.g. PC-T1-5F-001" {...register('pour_reference')} />
          <Input label="Sub-contractor" placeholder="Optional" {...register('sub_contractor_name')} />
        </div>
      </Card>

      <div className="qms-form-actions">
        <Button type="button" variant="outline" className="qms-flex-1" onClick={() => navigate(`/app/projects/${pid}/dispatches`)}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" className="qms-flex-2" disabled={createPour.isPending}>
          {createPour.isPending ? 'Recording…' : 'Record pour'}
        </Button>
      </div>
    </form>
  );
};
