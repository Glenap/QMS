// Floors setup — floors belong to a tower, so you pick a tower and bulk-generate
// its floors. A tower can hold at most the floor count entered for it during
// project setup (TowerResponse.floors_total). Pour cards need floors to exist
// here before a floor can be selected.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { useProject } from '../../components/layout/ProjectLayout';
import { projectsApi } from '../../api/projects';
import { floorsApi } from '../../api/floors';
import { getApiErrorMessage } from '../../api/client';
import type { FloorResponse, TowerResponse } from '../../types/master';

export const ProjectFloors: React.FC = () => {
  const { project } = useProject();
  const pid = project.project_id;
  const canManage =
    project.access.can_manage_client_side || project.access.can_manage_contractor_side;

  const [towers, setTowers] = useState<TowerResponse[]>([]);
  const [towerId, setTowerId] = useState('');
  const [floors, setFloors] = useState<FloorResponse[]>([]);
  const [loadingTowers, setLoadingTowers] = useState(true);
  const [loadingFloors, setLoadingFloors] = useState(false);
  const [prefix, setPrefix] = useState('L');
  const [count, setCount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Contractor-side managers only set up floors for their allotted towers.
  const visibleTowers = useMemo(() => {
    const scope = project.assigned_scope;
    if (!scope || scope === 'Entire project') return towers;
    const allowed = new Set(scope.split(',').map((s) => s.trim()));
    return towers.filter((t) => allowed.has(t.tower_name));
  }, [towers, project.assigned_scope]);

  const tower = useMemo(
    () => towers.find((t) => t.tower_id === Number(towerId)) ?? null,
    [towers, towerId],
  );
  const cap = tower?.floors_total ?? null;
  const remaining = cap != null ? Math.max(0, cap - floors.length) : null;
  const atCapacity = remaining === 0;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingTowers(true);
      try {
        const tw = await projectsApi.towers(pid);
        if (cancelled) return;
        setTowers(tw);
      } catch (err) {
        if (!cancelled) setError(getApiErrorMessage(err, 'Unable to load towers.'));
      } finally {
        if (!cancelled) setLoadingTowers(false);
      }
    })();
    return () => { cancelled = true; };
  }, [pid]);

  // Default to the first tower the viewer can actually see.
  useEffect(() => {
    if (!towerId && visibleTowers.length) setTowerId(String(visibleTowers[0].tower_id));
  }, [visibleTowers, towerId]);

  const loadFloors = useCallback(async (tid: number) => {
    setLoadingFloors(true);
    try {
      setFloors(await floorsApi.list(pid, tid));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to load floors.'));
    } finally {
      setLoadingFloors(false);
    }
  }, [pid]);

  useEffect(() => {
    if (towerId) void loadFloors(Number(towerId));
    else setFloors([]);
  }, [towerId, loadFloors]);

  // Default the count to "fill up to the cap" whenever the tower/floors change.
  useEffect(() => {
    if (cap != null) setCount(String(Math.max(0, cap - floors.length)));
  }, [cap, floors.length]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!towerId) return;
    const n = Number(count);
    if (!Number.isInteger(n) || n <= 0) { setError('Enter how many floors to add.'); return; }
    if (remaining != null && n > remaining) {
      setError(`This tower allows ${cap} floors — only ${remaining} more can be added.`);
      return;
    }
    setError(null); setSuccess(null); setSubmitting(true);
    // Continue numbering after the highest existing floor so labels don't clash.
    const start = floors.length
      ? Math.max(...floors.map((f) => f.floor_number ?? 0)) + 1
      : 1;
    try {
      const created = await floorsApi.generate(pid, Number(towerId), {
        count: n,
        start_number: start,
        label_prefix: prefix.trim() || 'L',
      });
      setSuccess(`Added ${created.length} floor${created.length === 1 ? '' : 's'} to ${tower?.tower_name ?? 'the tower'}.`);
      setShowForm(false);
      await loadFloors(Number(towerId));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to add floors.'));
    } finally {
      setSubmitting(false);
    }
  };

  const alert: React.CSSProperties = { padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 14 };

  return (
    <div>
      {error && <div style={{ ...alert, background: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5' }}>{error}</div>}
      {success && <div style={{ ...alert, background: '#DCFCE7', color: '#166534', border: '1px solid #86EFAC' }}>{success}</div>}

      {loadingTowers ? (
        <p className="text-muted qms-text-sm">Loading towers…</p>
      ) : visibleTowers.length === 0 ? (
        <Card className="qms-form-section">
          <p className="text-muted" style={{ fontSize: 14, margin: 0 }}>
            {towers.length === 0
              ? 'This project has no towers. Add towers in project setup first, then come back to add their floors.'
              : 'You have no towers assigned on this project yet.'}
          </p>
        </Card>
      ) : (
        <>
          <Card className="qms-form-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
              <h3 className="qms-section-heading-plain" style={{ margin: 0 }}>Tower floors</h3>
              {canManage && !showForm && (
                <Button variant="primary" size="sm" icon={<Plus size={15} />} disabled={atCapacity} onClick={() => setShowForm(true)}>
                  Add floors
                </Button>
              )}
            </div>
            <div className="qms-grid-2">
              <Select
                label="Tower"
                value={towerId}
                onChange={(e) => { setTowerId(e.target.value); setShowForm(false); }}
                options={visibleTowers.map((t) => ({
                  label: t.floors_total != null ? `${t.tower_name} (max ${t.floors_total} floors)` : t.tower_name,
                  value: t.tower_id,
                }))}
              />
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <p className="qms-text-sm text-muted" style={{ margin: 0 }}>
                  {floors.length} floor{floors.length === 1 ? '' : 's'} created
                  {cap != null ? ` of ${cap} allowed` : ''}
                  {remaining != null && remaining > 0 ? ` · ${remaining} more can be added` : ''}
                </p>
              </div>
            </div>

            {canManage && atCapacity && !showForm && (
              <p className="qms-text-sm text-muted" style={{ marginTop: 12, marginBottom: 0 }}>
                All {cap} floors for this tower have been created.
              </p>
            )}

            {canManage && showForm && (
              <form onSubmit={handleGenerate} className="qms-grid-2" style={{ marginTop: 16 }}>
                <Input
                  label="Floor label prefix"
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  placeholder="e.g. L → L1, L2, L3"
                />
                <Input
                  label="How many floors to add"
                  type="number"
                  min={1}
                  max={remaining ?? undefined}
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                  disabled={atCapacity}
                />
                <div style={{ gridColumn: 'span 2', display: 'flex', gap: 8 }}>
                  <Button type="submit" variant="primary" disabled={submitting || atCapacity} icon={<Plus size={16} />}>
                    {submitting ? 'Adding…' : 'Generate floors'}
                  </Button>
                  <Button type="button" variant="ghost" disabled={submitting} onClick={() => setShowForm(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </Card>

          <Card className="qms-form-section" padding="none">
            <div className="qms-p-4 qms-border-b">
              <h3 className="qms-section-heading-plain">Floors in {tower?.tower_name ?? 'this tower'}</h3>
            </div>
            <div className="qms-p-4">
              {loadingFloors ? (
                <p className="text-muted qms-text-sm" style={{ margin: 0 }}>Loading…</p>
              ) : floors.length === 0 ? (
                <p className="text-muted qms-text-sm" style={{ margin: 0 }}>No floors yet — use “Add floors” above.</p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {floors.map((f) => (
                    <span
                      key={f.floor_id}
                      style={{
                        padding: '6px 12px', borderRadius: 8, fontSize: 13,
                        border: '1px solid var(--gray-200)', background: 'var(--gray-50, #F9FAFB)',
                      }}
                    >
                      {f.floor_label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
};
