import React, { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useProject } from '../../components/layout/ProjectLayout';
import { projectsApi } from '../../api/projects';
import { floorsApi } from '../../api/floors';
import { getApiErrorMessage } from '../../api/client';
import type { FloorResponse, TowerResponse } from '../../types/master';

const alertStyle = (kind: 'error'): React.CSSProperties => ({
  padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: 13,
  ...(kind === 'error' ? { background: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5' } : {}),
});

const chip: React.CSSProperties = {
  display: 'inline-block', padding: '3px 10px', margin: '0 6px 6px 0',
  borderRadius: 6, background: 'var(--gray-100)', border: '1px solid var(--gray-200)',
  fontSize: 12, color: 'var(--gray-700)',
};

const TowerFloors: React.FC<{ projectId: number; tower: TowerResponse; canManage: boolean }> = ({
  projectId, tower, canManage,
}) => {
  const [floors, setFloors] = useState<FloorResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setFloors(await floorsApi.list(projectId, tower.tower_id));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to load floors.'));
    } finally {
      setLoading(false);
    }
  }, [projectId, tower.tower_id]);

  useEffect(() => { void load(); }, [load]);

  const generate = async () => {
    const n = Number(count);
    if (!Number.isInteger(n) || n <= 0) { setError('Enter a floor count greater than 0.'); return; }
    setError(null); setBusy(true);
    try {
      await floorsApi.generate(projectId, tower.tower_id, { count: n });
      setCount('');
      void load();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to generate floors.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="qms-form-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h3 className="qms-section-heading-plain">{tower.tower_name}</h3>
        <span className="text-muted qms-text-sm">{floors.length} floors</span>
      </div>

      {error && <div style={alertStyle('error')}>{error}</div>}

      {loading ? (
        <p className="text-muted qms-text-sm">Loading…</p>
      ) : floors.length === 0 ? (
        <p className="text-muted qms-text-sm">No floors yet.</p>
      ) : (
        <div>{floors.map((f) => <span key={f.floor_id} style={chip}>{f.floor_label}</span>)}</div>
      )}

      {canManage && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 12 }}>
          <Input
            label="Generate floors (count)" type="number" fullWidth={false}
            value={count} onChange={(e) => setCount(e.target.value)}
            placeholder={`e.g. ${tower.floors_total ?? 10}`}
          />
          <Button variant="outline" icon={<Plus size={16} />} disabled={busy} onClick={generate}>
            {busy ? 'Generating…' : 'Generate'}
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

  const [towers, setTowers] = useState<TowerResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const tw = await projectsApi.towers(pid);
        if (!cancelled) setTowers(tw);
      } catch (err) {
        if (!cancelled) setError(getApiErrorMessage(err, 'Unable to load towers.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [pid]);

  return (
    <div>
      <div className="qms-page-header-block">
        <div>
          <h2 className="qms-section-heading-plain">Structure</h2>
          <p className="qms-page-subtitle">Towers and floors — floors are required to raise pour cards.</p>
        </div>
      </div>

      {error && <div style={alertStyle('error')}>{error}</div>}

      {loading ? (
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
