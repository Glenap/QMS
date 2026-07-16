import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { ErrorBox } from '../../components/ui/ErrorBox';
import { useProject } from '../../components/layout/ProjectLayout';
import { getApiErrorMessage } from '../../api/client';
import { toast } from '../../lib/toast';
import { useFloors, useGenerateFloors, useProjectTowers } from '../../queries/floors';
import type { TowerResponse } from '../../types/master';
import './ProjectStructure.css';

const TowerFloors: React.FC<{ projectId: number; tower: TowerResponse; canManage: boolean }> = ({
  projectId, tower, canManage,
}) => {
  const { data: floors = [], isPending, error: loadError } = useFloors(projectId, tower.tower_id);
  const generate = useGenerateFloors(projectId);
  const [count, setCount] = useState('');

  const handleGenerate = async () => {
    const n = Number(count);
    if (!Number.isInteger(n) || n <= 0) { toast.error('Enter a floor count greater than 0.'); return; }
    try {
      await generate.mutateAsync({ towerId: tower.tower_id, data: { count: n } });
      toast.success(`Added ${n} floor${n === 1 ? '' : 's'} to ${tower.tower_name}.`);
      setCount('');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Unable to generate floors.'));
    }
  };

  return (
    <Card className="qms-form-section">
      <div className="qms-row-between qms-mb-12">
        <h3 className="qms-section-heading-plain">{tower.tower_name}</h3>
        <span className="text-muted qms-text-sm">{floors.length} floors</span>
      </div>

      {loadError && <ErrorBox>{getApiErrorMessage(loadError, 'Unable to load floors.')}</ErrorBox>}

      {isPending ? (
        <p className="text-muted qms-text-sm">Loading…</p>
      ) : floors.length === 0 ? (
        <p className="text-muted qms-text-sm">No floors yet.</p>
      ) : (
        <div className="qms-chip-row">{floors.map((f) => <span key={f.floor_id} className="qms-chip">{f.floor_label}</span>)}</div>
      )}

      {canManage && (
        <div className="qms-structure-gen">
          <Input
            label="Generate floors (count)" type="number" fullWidth={false}
            value={count} onChange={(e) => setCount(e.target.value)}
            placeholder={`e.g. ${tower.floors_total ?? 10}`}
          />
          <Button variant="outline" icon={<Plus size={16} />} disabled={generate.isPending} onClick={handleGenerate}>
            {generate.isPending ? 'Generating…' : 'Generate'}
          </Button>
        </div>
      )}
    </Card>
  );
};

export const ProjectStructure: React.FC = () => {
  const { project } = useProject();
  const pid = project.project_id;
  const canManage = project.access.can_manage_client_side || project.access.can_manage_contractor_side;

  const { data: towers = [], isPending, error: loadError } = useProjectTowers(pid);

  return (
    <div>
      {loadError && <ErrorBox>{getApiErrorMessage(loadError, 'Unable to load towers.')}</ErrorBox>}

      {isPending ? (
        <p className="text-muted">Loading…</p>
      ) : towers.length === 0 ? (
        <Card className="qms-form-section">
          <p className="text-muted qms-text-sm">No towers yet. Towers are added when the project is created.</p>
        </Card>
      ) : (
        towers.map((t) => <TowerFloors key={t.tower_id} projectId={pid} tower={t} canManage={canManage} />)
      )}
    </div>
  );
};
