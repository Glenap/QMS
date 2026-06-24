import React, { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useProject } from '../../components/layout/ProjectLayout';
import { mixDesignsApi } from '../../api/mixDesigns';
import { suppliersApi } from '../../api/suppliers';
import { catalogApi } from '../../api/catalog';
import { getApiErrorMessage } from '../../api/client';
import type {
  GradeResponse,
  MixApprovalStatus,
  MixDesignCreate,
  MixDesignResponse,
  SupplierResponse,
} from '../../types/master';

const APPROVAL_VARIANT: Record<MixApprovalStatus, 'pass' | 'fail' | 'warn'> = {
  APPROVED: 'pass', REJECTED: 'fail', IN_PROGRESS: 'warn',
};

const num = (v: string): number | undefined => {
  const t = v.trim();
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isNaN(n) ? undefined : n;
};

const EMPTY = { supplier_id: '', grade_id: '', wc_ratio: '', approval_status: 'IN_PROGRESS' as MixApprovalStatus };

export const ProjectMixDesigns: React.FC = () => {
  const { project } = useProject();
  const pid = project.project_id;
  const canManage = project.access.can_manage_contractor_side;

  const [rows, setRows] = useState<MixDesignResponse[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierResponse[]>([]);
  const [grades, setGrades] = useState<GradeResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ ...EMPTY });
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [md, sup, gr] = await Promise.all([
        mixDesignsApi.list(pid),
        suppliersApi.list(pid),
        catalogApi.grades(),
      ]);
      setRows(md);
      setSuppliers(sup);
      setGrades(gr);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to load mix designs.'));
    } finally {
      setLoading(false);
    }
  }, [pid]);

  useEffect(() => { void load(); }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setSuccess(null); setSubmitting(true);
    const payload: MixDesignCreate = {
      supplier_id: Number(form.supplier_id),
      grade_id: Number(form.grade_id),
      wc_ratio: num(form.wc_ratio),
      approval_status: form.approval_status,
    };
    try {
      const md = await mixDesignsApi.create(pid, payload);
      setSuccess(`Mix design for ${md.grade_name} (${md.supplier_name}) added.`);
      setForm({ ...EMPTY });
      setShowForm(false);
      void load();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to add mix design.'));
    } finally {
      setSubmitting(false);
    }
  };

  const alert: React.CSSProperties = { padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 14 };
  const canAdd = form.supplier_id !== '' && form.grade_id !== '';

  return (
    <div>
      {error && <div style={{ ...alert, background: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5' }}>{error}</div>}
      {success && <div style={{ ...alert, background: '#DCFCE7', color: '#166534', border: '1px solid #86EFAC' }}>{success}</div>}

      {canManage && showForm && (
        <Card className="qms-form-section">
          <h3 className="qms-section-heading-plain" style={{ marginBottom: 12 }}>Add a mix design</h3>
          {suppliers.length === 0 ? (
            <div>
              <p className="text-muted" style={{ fontSize: 14, marginTop: 0 }}>
                Register a supplier first — mix designs are tied to a supplier and grade.
              </p>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="qms-grid-2">
              <Select
                label="Supplier" required value={form.supplier_id} onChange={set('supplier_id')}
                options={[{ label: 'Select a supplier…', value: '' },
                  ...suppliers.map((s) => ({ label: s.supplier_name, value: s.supplier_id }))]}
              />
              <Select
                label="Grade" required value={form.grade_id} onChange={set('grade_id')}
                options={[{ label: 'Select a grade…', value: '' },
                  ...grades.map((g) => ({ label: g.grade_name, value: g.grade_id }))]}
              />
              <Input label="W/C ratio" type="number" step="0.01" value={form.wc_ratio} onChange={set('wc_ratio')} placeholder="e.g. 0.42" />
              <Select
                label="Approval status" value={form.approval_status} onChange={set('approval_status')}
                options={[
                  { label: 'In progress', value: 'IN_PROGRESS' },
                  { label: 'Approved', value: 'APPROVED' },
                  { label: 'Rejected', value: 'REJECTED' },
                ]}
              />
              <div style={{ gridColumn: 'span 2', display: 'flex', gap: 8 }}>
                <Button type="submit" variant="primary" disabled={submitting || !canAdd} icon={<Plus size={16} />}>
                  {submitting ? 'Adding…' : 'Add mix design'}
                </Button>
                <Button type="button" variant="ghost" disabled={submitting} onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </Card>
      )}

      <Card className="qms-form-section" padding="none">
        <div className="qms-p-4 qms-border-b" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <h3 className="qms-section-heading-plain">Mix designs</h3>
          {canManage && !showForm && (
            <Button variant="primary" size="sm" icon={<Plus size={15} />} onClick={() => setShowForm(true)}>
              Add mix design
            </Button>
          )}
        </div>
        <div className="qms-table-container">
          <table className="qms-table">
            <thead><tr><th>Grade</th><th>Supplier</th><th>W/C ratio</th><th>28-day (MPa)</th><th>Approval</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-muted">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="text-muted">No mix designs yet.</td></tr>
              ) : (
                rows.map((m) => (
                  <tr key={m.mix_design_id}>
                    <td className="font-medium">{m.grade_name ?? '—'}</td>
                    <td>{m.supplier_name ?? '—'}</td>
                    <td>{m.wc_ratio != null ? m.wc_ratio : '—'}</td>
                    <td>{m.strength_28day_mpa != null ? m.strength_28day_mpa : '—'}</td>
                    <td>
                      {m.approval_status
                        ? <Badge variant={APPROVAL_VARIANT[m.approval_status]}>{m.approval_status.replace('_', ' ')}</Badge>
                        : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
