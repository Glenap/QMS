// Project Retests page — every IS-456 in-situ retest (core cutting / rebound /
// UPV) ordered across the project's NCRs. Retests are ordered from an NCR (the
// "retest" corrective measure); here the QE records each pending retest's result.
// A passing retest supports closing the NCR without demolition.

import React, { useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { ErrorBox } from '../../components/ui/ErrorBox';
import { useProject } from '../../components/layout/ProjectLayout';
import { getApiErrorMessage } from '../../api/client';
import { toast } from '../../lib/toast';
import { useProjectRetests, useRecordRetest } from '../../components/ncr/queries';
import { RETEST_RESULT_BADGE, RETEST_TYPE_LABEL, fmtDate } from '../../components/ncr/ncrFormat';
import type { RetestResponse, RetestResult } from '../../types/master';

const RESULT_OPTIONS = [
  { label: 'Pass', value: 'PASS' },
  { label: 'Fail', value: 'FAIL' },
];

const RetestCard: React.FC<{ pid: number; retest: RetestResponse; isQE: boolean }> = ({ pid, retest, isQE }) => {
  const record = useRecordRetest(pid, retest.ncr_id);
  const pending = retest.result === null;
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<RetestResult>('PASS');
  const [observed, setObserved] = useState('');
  const [required, setRequired] = useState(retest.required_strength_mpa != null ? String(retest.required_strength_mpa) : '');
  const [testDate, setTestDate] = useState('');
  const [notes, setNotes] = useState('');

  const save = async () => {
    try {
      await record.mutateAsync({
        retestId: retest.retest_id,
        data: {
          result,
          observed_strength_mpa: observed ? Number(observed) : null,
          required_strength_mpa: required ? Number(required) : null,
          test_date: testDate || null,
          notes: notes.trim() || null,
        },
      });
      toast.success('Retest result recorded.');
      setOpen(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not record the retest result.'));
    }
  };

  return (
    <Card className="qms-form-section">
      <div className="qms-detail-title-row">
        <span className="font-medium" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <FlaskConical size={16} /> {RETEST_TYPE_LABEL[retest.retest_type]}
          {retest.ncr_number && <span className="qms-text-sm text-muted">· {retest.ncr_number}</span>}
        </span>
        {pending
          ? <Badge variant="pending">Pending</Badge>
          : <Badge variant={RETEST_RESULT_BADGE[retest.result!].variant}>{RETEST_RESULT_BADGE[retest.result!].label}</Badge>}
      </div>

      <div className="qms-text-sm text-muted qms-detail-meta" style={{ margin: '6px 0' }}>
        {retest.grade_name && <span>Grade: {retest.grade_name}</span>}
        {retest.observed_strength_mpa != null && (
          <span>{retest.observed_strength_mpa} MPa{retest.required_strength_mpa != null ? ` / ${retest.required_strength_mpa} MPa required` : ''}</span>
        )}
        {retest.test_date && <span>Tested {fmtDate(retest.test_date)}</span>}
        {retest.ordered_by_name && <span>Ordered by {retest.ordered_by_name}</span>}
      </div>
      {retest.notes && <p className="qms-text-sm" style={{ margin: '4px 0' }}>{retest.notes}</p>}

      {isQE && pending && (
        open ? (
          <div className="qms-grid-3" style={{ marginTop: 10, alignItems: 'end' }}>
            <Select label="Result" fullWidth={false} value={result} onChange={(e) => setResult(e.target.value as RetestResult)} options={RESULT_OPTIONS} />
            <Input label="Observed (MPa)" type="number" min="0" step="0.1" value={observed} onChange={(e) => setObserved(e.target.value)} />
            <Input label="Required (MPa)" type="number" min="0" step="0.1" value={required} onChange={(e) => setRequired(e.target.value)} />
            <Input label="Test date" type="date" value={testDate} onChange={(e) => setTestDate(e.target.value)} />
            <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. core satisfies IS 456" />
            <div className="qms-form-actions" style={{ alignSelf: 'end' }}>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button variant="primary" disabled={record.isPending} onClick={save}>
                {record.isPending ? 'Saving…' : 'Save result'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="qms-form-actions">
            <Button variant="outline" size="sm" onClick={() => setOpen(true)}>Record result</Button>
          </div>
        )
      )}
    </Card>
  );
};

export const Retests: React.FC = () => {
  const { project } = useProject();
  const pid = project.project_id;
  const isQE = project.access.project_role === 'QUALITY_ENGINEER';
  const { data: retests = [], isPending, error } = useProjectRetests(pid);

  return (
    <div>
      {error && <ErrorBox>{getApiErrorMessage(error, 'Unable to load retests.')}</ErrorBox>}

      {isPending ? (
        <p className="text-muted qms-text-sm">Loading…</p>
      ) : retests.length === 0 ? (
        <Card className="qms-form-section">
          <p className="text-muted qms-text-sm">
            No retests ordered yet — order one from an NCR&apos;s corrective measures.
          </p>
        </Card>
      ) : (
        retests.map((r) => <RetestCard key={r.retest_id} pid={pid} retest={r} isQE={isQE} />)
      )}
    </div>
  );
};
