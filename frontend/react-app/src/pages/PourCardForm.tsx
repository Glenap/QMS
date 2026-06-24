// Raise a pour card — captures the pour identification, grade, supplier and
// planned volume, then creates a PLANNED pour (QUALITY_ENGINEER only).
//
// Pre-pour checklist, per-truck logging and cube sampling arrive in later
// phases (dispatch + cube tests) once those models are wired.

import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';
import { useProject } from '../components/layout/ProjectLayout';
import { projectsApi } from '../api/projects';
import { catalogApi } from '../api/catalog';
import { suppliersApi } from '../api/suppliers';
import { floorsApi } from '../api/floors';
import { poursApi } from '../api/pours';
import { getApiErrorMessage } from '../api/client';
import type {
  ComponentResponse,
  FloorResponse,
  GradeResponse,
  PourCreate,
  SupplierResponse,
  TowerResponse,
} from '../types/master';
import './PourCardForm.css';

const COMPONENT_LABEL: Record<string, string> = {
  COLUMN: 'Column', SLAB: 'Slab', BEAM: 'Beam', RAFT: 'Raft',
  SHEAR_WALL: 'Shear wall', STAIRCASE: 'Staircase', LIFT_CORE: 'Lift core', FOUNDATION: 'Foundation',
};

const num = (v: string): number | undefined => {
  const t = v.trim();
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isNaN(n) ? undefined : n;
};

export const PourCardForm: React.FC = () => {
  const { user } = useAuth();
  const { project } = useProject();
  const navigate = useNavigate();
  const pid = project.project_id;

  const [towers, setTowers] = useState<TowerResponse[]>([]);
  const [components, setComponents] = useState<ComponentResponse[]>([]);
  const [grades, setGrades] = useState<GradeResponse[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierResponse[]>([]);
  const [floors, setFloors] = useState<FloorResponse[]>([]);

  const [towerId, setTowerId] = useState('');
  const [floorId, setFloorId] = useState('');
  const [componentId, setComponentId] = useState('');
  const [gradeId, setGradeId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [subContractor, setSubContractor] = useState('');
  const [pourDate, setPourDate] = useState('');
  const [pourReference, setPourReference] = useState('');
  const [volume, setVolume] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [tw, comp, gr, sup] = await Promise.all([
          projectsApi.towers(pid),
          catalogApi.components(),
          catalogApi.grades(),
          suppliersApi.list(pid),
        ]);
        if (cancelled) return;
        setTowers(tw); setComponents(comp); setGrades(gr); setSuppliers(sup);
      } catch (err) {
        if (!cancelled) setError(getApiErrorMessage(err, 'Unable to load reference data.'));
      }
    })();
    return () => { cancelled = true; };
  }, [pid]);

  useEffect(() => {
    if (!towerId) { setFloors([]); setFloorId(''); return; }
    let cancelled = false;
    (async () => {
      try {
        const fl = await floorsApi.list(pid, Number(towerId));
        if (!cancelled) setFloors(fl);
      } catch {
        if (!cancelled) setFloors([]);
      }
    })();
    return () => { cancelled = true; };
  }, [pid, towerId]);

  // A contractor only works on their allotted towers — restrict the picker to
  // those. Clients and whole-project contractors (scope null / "Entire project")
  // see every tower.
  const visibleTowers = useMemo(() => {
    const scope = project.assigned_scope;
    if (!scope || scope === 'Entire project') return towers;
    const allowed = new Set(scope.split(',').map((s) => s.trim()));
    return towers.filter((t) => allowed.has(t.tower_name));
  }, [towers, project.assigned_scope]);

  // When the contractor is assigned a single tower, the client has effectively
  // chosen it for them — auto-fill and lock the picker (it's passed on, not a choice).
  const towerLocked = visibleTowers.length === 1;
  useEffect(() => {
    if (!towerId && visibleTowers.length === 1) setTowerId(String(visibleTowers[0].tower_id));
  }, [visibleTowers, towerId]);

  // Pour cards are raised by the Quality Engineer only.
  if (user && user.role !== 'QUALITY_ENGINEER') {
    return <Navigate to={`/app/projects/${pid}`} replace />;
  }

  const canSubmit =
    towerId !== '' && floorId !== '' && componentId !== '' &&
    gradeId !== '' && supplierId !== '' && pourDate !== '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const payload: PourCreate = {
      tower_id: Number(towerId),
      floor_id: Number(floorId),
      component_id: Number(componentId),
      grade_id: Number(gradeId),
      supplier_horizontal_id: Number(supplierId),
      pour_date: pourDate,
      pour_reference: pourReference.trim() || null,
      volume_cum: num(volume) ?? null,
      sub_contractor_name: subContractor.trim() || null,
    };
    try {
      await poursApi.create(pid, payload);
      navigate(`/app/projects/${pid}/pours`);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to create pour.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="qms-pour-form" onSubmit={handleSubmit}>
      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 14, background: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5' }}>
          {error}
        </div>
      )}

      <Card className="qms-form-section">
        <h3 className="qms-section-heading">A · Pour identification</h3>
        <div className="qms-grid-3">
          <Select
            label="Tower"
            required
            value={towerId}
            disabled={towerLocked}
            onChange={(e) => setTowerId(e.target.value)}
            options={
              towerLocked
                ? visibleTowers.map((t) => ({ label: t.tower_name, value: t.tower_id }))
                : [
                    { label: visibleTowers.length ? 'Select tower…' : 'No towers assigned to you', value: '' },
                    ...visibleTowers.map((t) => ({ label: t.tower_name, value: t.tower_id })),
                  ]
            }
          />
          <Select label="Floor" required value={floorId} onChange={(e) => setFloorId(e.target.value)} options={[
            { label: !towerId ? 'Pick a tower first' : floors.length ? 'Select floor…' : 'No floors — add them in Setup › Floors', value: '' },
            ...floors.map((f) => ({ label: f.floor_label, value: f.floor_id })),
          ]} />
          <Select label="Component type" required value={componentId} onChange={(e) => setComponentId(e.target.value)} options={[
            { label: 'Select component…', value: '' },
            ...components.map((c) => ({ label: COMPONENT_LABEL[c.component_type] ?? c.component_type, value: c.component_id })),
          ]} />
        </div>
      </Card>

      <Card className="qms-form-section">
        <h3 className="qms-section-heading">B · Concrete & supply</h3>
        <div className="qms-grid-3">
          <Select label="Grade" required value={gradeId} onChange={(e) => setGradeId(e.target.value)} options={[
            { label: 'Select grade…', value: '' },
            ...grades.map((g) => ({ label: g.grade_name, value: g.grade_id })),
          ]} />
          <Select label="RMC supplier" required value={supplierId} onChange={(e) => setSupplierId(e.target.value)} options={[
            { label: suppliers.length ? 'Select supplier…' : 'No suppliers yet', value: '' },
            ...suppliers.map((s) => ({ label: s.supplier_name, value: s.supplier_id })),
          ]} />
          <Input label="Sub-contractor" value={subContractor} onChange={(e) => setSubContractor(e.target.value)} placeholder="Optional" />
        </div>
      </Card>

      <Card className="qms-form-section">
        <h3 className="qms-section-heading">C · Pour details</h3>
        <div className="qms-grid-3">
          <Input label="Pour date" type="date" required value={pourDate} onChange={(e) => setPourDate(e.target.value)} />
          <Input label="Pour reference" value={pourReference} onChange={(e) => setPourReference(e.target.value)} placeholder="e.g. PC-T1-5F-001" />
          <Input label="Planned volume (m³)" type="number" step="0.1" value={volume} onChange={(e) => setVolume(e.target.value)} />
        </div>
        <p className="qms-text-sm text-muted" style={{ marginTop: 8 }}>
          Pre-pour checklist, per-truck logging and cube sampling are added in later phases.
        </p>
      </Card>

      <div className="qms-form-actions">
        <Button type="button" variant="outline" style={{ flex: 1 }} onClick={() => navigate(`/app/projects/${pid}/pours`)}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" style={{ flex: 2 }} disabled={submitting || !canSubmit}>
          {submitting ? 'Creating…' : 'Create pour card'}
        </Button>
      </div>
    </form>
  );
};
