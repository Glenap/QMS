import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FlaskConical, Mail, Paperclip, Plus, Send } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { getApiErrorMessage } from '../../api/client';
import { useUploadDocument } from '../../queries/documents';
import type { ActionStatus, NCRDetailResponse, NCRStatus, RetestType } from '../../types/master';
import { AISuggestionSection } from './AISuggestionSection';
import {
  ACTION_BADGE,
  ACTION_STATUS_OPTIONS,
  fmtDate,
  RETEST_RESULT_BADGE,
  RETEST_TYPE_LABEL,
  RETEST_TYPE_OPTIONS,
  STATUS_BADGE,
} from './ncrFormat';
import { ErrorBox } from '../ui/ErrorBox';
import {
  useAddCorrectiveAction,
  useNcrDetail,
  useNotifyRmc,
  useOrderRetest,
  useUpdateCorrectiveAction,
  useUpdateNcr,
} from './queries';

interface PanelProps {
  pid: number;
  ncrId: number;
  isQE: boolean;
}

// A default RMC-report subject + body composed from the NCR context — the QE can
// edit both before sending (blank fields fall back to the server's own compose).
const defaultNotice = (ncr: NCRDetailResponse) => {
  const ref = ncr.ncr_number ?? `NCR-${ncr.ncr_id}`;
  const subject = `${ref} raised on your supply`;
  const parts = [`${ref} has been raised against concrete you supplied.`];
  if (ncr.grade_name) parts.push(`Grade: ${ncr.grade_name}.`);
  if (ncr.observed_strength_mpa != null && ncr.required_strength_mpa != null) {
    parts.push(
      `The ${ncr.test_age_days ?? 28}-day strength was ${ncr.observed_strength_mpa} MPa `
      + `against a required ${ncr.required_strength_mpa} MPa.`,
    );
  }
  parts.push('Please review your batch/plant records and respond with corrective action.');
  return { subject, message: parts.join(' ') };
};

export const NCRDetailPanel: React.FC<PanelProps> = ({ pid, ncrId, isQE }) => {
  const { data: ncr, isPending, error: loadError } = useNcrDetail(pid, ncrId);
  const navigate = useNavigate();

  const updateNcr = useUpdateNcr(pid, ncrId);
  const addAction = useAddCorrectiveAction(pid, ncrId);
  const updateAction = useUpdateCorrectiveAction(pid, ncrId);
  const orderRetest = useOrderRetest(pid, ncrId);
  const notifyRmc = useNotifyRmc(pid, ncrId);
  const uploadDoc = useUploadDocument(pid);
  const busy = updateNcr.isPending || addAction.isPending || updateAction.isPending
    || orderRetest.isPending || notifyRmc.isPending || uploadDoc.isPending;

  const [actionError, setActionError] = useState<string | null>(null);
  const [rootCause, setRootCause] = useState('');
  const [actionDesc, setActionDesc] = useState('');
  const [actionDue, setActionDue] = useState('');
  const [retestType, setRetestType] = useState<RetestType>('CORE_CUTTING');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [reportFile, setReportFile] = useState<File | null>(null);

  const composed = useMemo(() => (ncr ? defaultNotice(ncr) : null), [ncr]);

  // Seed the editable root-cause field from server data (and re-sync when it
  // changes server-side, e.g. after applying an AI suggestion).
  useEffect(() => {
    if (ncr) setRootCause(ncr.root_cause ?? '');
  }, [ncr?.root_cause]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-fill the RMC notice once from the NCR context.
  useEffect(() => {
    if (composed) {
      setSubject(composed.subject);
      setMessage(composed.message);
    }
  }, [composed]);

  // Await a mutation; surface a single error and clear it on the next attempt.
  const run = async (p: Promise<unknown>, fail = 'Action failed.') => {
    setActionError(null);
    try {
      await p;
    } catch (err) {
      setActionError(getApiErrorMessage(err, fail));
    }
  };

  if (isPending) return <p className="text-muted qms-ncr-detail-msg">Loading…</p>;
  if (!ncr) return <p className="text-danger qms-ncr-detail-msg">{loadError ? getApiErrorMessage(loadError, 'Unable to load NCR.') : 'Not found.'}</p>;

  const isClosed = ncr.status === 'CLOSED';
  const rootCauseId = `ncr-rootcause-${ncrId}`;

  const saveRootCause = () => run(updateNcr.mutateAsync({ root_cause: rootCause.trim() || null }));
  const setStatus = (status: NCRStatus) => run(updateNcr.mutateAsync({ status }));
  const addActionSubmit = () => run(
    addAction.mutateAsync({ action_description: actionDesc.trim(), due_date: actionDue || null })
      .then(() => { setActionDesc(''); setActionDue(''); }),
  );
  const setActionStatus = (actionId: number, status: ActionStatus) =>
    run(updateAction.mutateAsync({ actionId, data: { status } }));

  // Order a retest (a corrective measure) → then jump to the Retests page where
  // its result is recorded.
  const orderRetestSubmit = () => run(
    orderRetest.mutateAsync({ retest_type: retestType })
      .then(() => navigate(`/app/projects/${pid}/retests`)),
    'Could not order the retest.',
  );

  // Send the RMC report: upload the PDF first (if attached), then notify with its id.
  const sendRmc = () => run((async () => {
    let documentId: number | undefined;
    if (reportFile) {
      const doc = await uploadDoc.mutateAsync({ file: reportFile, documentType: 'NCR_REPORT' });
      documentId = doc.document_id;
    }
    await notifyRmc.mutateAsync({
      subject: subject.trim() || null,
      message: message.trim() || null,
      document_id: documentId ?? null,
    });
    setReportFile(null);
  })(), 'Could not send the report to the RMC.');

  return (
    <div className="qms-ncr-detail">
      {actionError && <ErrorBox>{actionError}</ErrorBox>}

      {/* Status + transitions */}
      <div className="qms-ncr-detail-statusbar">
        <Badge variant={STATUS_BADGE[ncr.status].variant} icon={STATUS_BADGE[ncr.status].icon}>
          {STATUS_BADGE[ncr.status].label}
        </Badge>
        {ncr.raised_by_name && <span className="qms-text-sm text-muted">Raised by {ncr.raised_by_name}</span>}
        {ncr.closed_at && <span className="qms-text-sm text-muted">Closed {fmtDate(ncr.closed_at)}</span>}
        {isQE && (
          <div className="qms-ncr-detail-transitions">
            {ncr.status === 'OPEN' && (
              <Button size="sm" variant="primary" disabled={busy} onClick={() => setStatus('UNDER_REVIEW')}>Start review</Button>
            )}
            {ncr.status === 'UNDER_REVIEW' && (
              <>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => setStatus('OPEN')}>Back to open</Button>
                <Button size="sm" variant="primary" disabled={busy} onClick={() => setStatus('CLOSED')}>Close NCR</Button>
              </>
            )}
            {ncr.status === 'CLOSED' && (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => setStatus('UNDER_REVIEW')}>Reopen</Button>
            )}
          </div>
        )}
      </div>

      {/* AI suggestion + pattern (RAG over past resolved NCRs + recurring-failure insight) */}
      <AISuggestionSection pid={pid} ncrId={ncrId} isQE={isQE} isClosed={isClosed} />

      {/* Root cause */}
      <div>
        <h4 className="qms-section-heading qms-ncr-block-heading">
          {isQE && !isClosed ? <label htmlFor={rootCauseId}>Root cause</label> : 'Root cause'}
        </h4>
        {isQE && !isClosed ? (
          <>
            <textarea
              id={rootCauseId}
              className="qms-ncr-textarea"
              value={rootCause}
              onChange={(e) => setRootCause(e.target.value)}
              rows={2}
              placeholder="What caused this non-conformance?"
            />
            <div className="qms-ncr-block-actions">
              <Button size="sm" variant="outline" disabled={busy || rootCause.trim() === (ncr.root_cause ?? '')} onClick={saveRootCause}>
                Save root cause
              </Button>
            </div>
          </>
        ) : (
          <p className={`qms-ncr-block-text ${ncr.root_cause ? '' : 'text-muted'}`}>{ncr.root_cause ?? 'Not recorded yet.'}</p>
        )}
      </div>

      {/* Corrective actions */}
      <div>
        <h4 className="qms-section-heading qms-ncr-block-heading">Corrective actions</h4>
        {ncr.corrective_actions.length === 0 ? (
          <p className="text-muted qms-ncr-block-empty">None logged yet.</p>
        ) : (
          <table className="qms-table qms-ncr-block-table">
            <thead>
              <tr><th>Action</th><th>Assigned</th><th>Due</th><th>Status</th></tr>
            </thead>
            <tbody>
              {ncr.corrective_actions.map((a) => (
                <tr key={a.action_id}>
                  <td>{a.action_description}</td>
                  <td>{a.assigned_to_name ?? '—'}</td>
                  <td>{fmtDate(a.due_date)}</td>
                  <td>
                    {isQE && !isClosed ? (
                      <Select
                        aria-label={`Status — ${a.action_description}`}
                        value={a.status}
                        onChange={(e) => setActionStatus(a.action_id, e.target.value as ActionStatus)}
                        options={ACTION_STATUS_OPTIONS}
                      />
                    ) : (
                      <Badge variant={ACTION_BADGE[a.status].variant}>{ACTION_BADGE[a.status].label}</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {isQE && !isClosed && (
          <div className="qms-grid-3 qms-ncr-block-form">
            <Input label="New action" value={actionDesc} onChange={(e) => setActionDesc(e.target.value)} placeholder="e.g. Re-pour affected section" />
            <Input label="Due date" type="date" value={actionDue} onChange={(e) => setActionDue(e.target.value)} />
            <div>
              <Button size="sm" variant="outline" icon={<Plus size={14} />} disabled={busy || actionDesc.trim() === ''} onClick={addActionSubmit}>
                Add action
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Retests (IS-456 in-situ verification — NDT / core) */}
      <div>
        <h4 className="qms-section-heading qms-ncr-block-heading">Retests (NDT / core)</h4>
        {ncr.retests.length === 0 ? (
          <p className="text-muted qms-ncr-block-empty">No retest ordered.</p>
        ) : (
          <table className="qms-table qms-ncr-block-table">
            <thead>
              <tr><th>Method</th><th>Result</th><th>Strength</th><th>Tested</th></tr>
            </thead>
            <tbody>
              {ncr.retests.map((r) => (
                <tr key={r.retest_id}>
                  <td className="font-medium">{RETEST_TYPE_LABEL[r.retest_type]}</td>
                  <td>
                    {r.result
                      ? <Badge variant={RETEST_RESULT_BADGE[r.result].variant}>{RETEST_RESULT_BADGE[r.result].label}</Badge>
                      : <Badge variant="pending">Pending</Badge>}
                  </td>
                  <td>{r.observed_strength_mpa != null ? `${r.observed_strength_mpa} MPa` : '—'}</td>
                  <td>{fmtDate(r.test_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {isQE && !isClosed && (
          <div className="qms-grid-3 qms-ncr-block-form">
            <Select
              label="Retest method"
              value={retestType}
              onChange={(e) => setRetestType(e.target.value as RetestType)}
              options={RETEST_TYPE_OPTIONS}
            />
            <div />
            <div>
              <Button size="sm" variant="outline" icon={<FlaskConical size={14} />} disabled={busy} onClick={orderRetestSubmit}>
                Order retest
              </Button>
            </div>
            <p className="qms-text-sm text-muted qms-ncr-retest-hint">
              Records the result on the Retests page — a passing retest supports closing without demolition.
            </p>
          </div>
        )}
      </div>

      {/* Notify the RMC (formal report email, optional PDF attachment) */}
      <div>
        <h4 className="qms-section-heading qms-ncr-block-heading">Notify RMC</h4>
        {ncr.rmc_notifications.length > 0 && (
          <table className="qms-table qms-ncr-block-table">
            <thead>
              <tr><th>Subject</th><th>Report</th><th>Sent by</th><th>Sent</th></tr>
            </thead>
            <tbody>
              {ncr.rmc_notifications.map((nf) => (
                <tr key={nf.notification_id}>
                  <td className="font-medium">{nf.subject}</td>
                  <td>{nf.report_document_id ? <Badge variant="info">PDF</Badge> : '—'}</td>
                  <td>{nf.sent_by_name ?? '—'}</td>
                  <td>{fmtDate(nf.sent_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {isQE ? (
          <div className="qms-ncr-block-form">
            <Input label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
            <label className="qms-input-label" style={{ display: 'block', marginTop: 8 }}>
              Message
              <textarea
                className="qms-ncr-textarea"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
              />
            </label>
            <div className="qms-ncr-block-actions" style={{ alignItems: 'center', gap: 12 }}>
              <label className="qms-ncr-attach">
                <Paperclip size={14} />
                <span>{reportFile ? reportFile.name : 'Attach PDF report (optional)'}</span>
                <input
                  type="file"
                  accept="application/pdf"
                  hidden
                  onChange={(e) => setReportFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {reportFile && (
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => setReportFile(null)}>Remove</Button>
              )}
              <Button
                size="sm"
                variant="primary"
                icon={<Send size={14} />}
                disabled={busy || !subject.trim() || !message.trim()}
                onClick={sendRmc}
              >
                {busy && (notifyRmc.isPending || uploadDoc.isPending) ? 'Sending…' : 'Send report to RMC'}
              </Button>
            </div>
          </div>
        ) : ncr.rmc_notifications.length === 0 && (
          <p className="text-muted qms-ncr-block-empty">
            <Mail size={13} /> The RMC has not been notified.
          </p>
        )}
      </div>
    </div>
  );
};
