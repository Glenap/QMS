// Conformance Analyser — the DefectSpec inspection workflow, native. Upload site
// photos per phase (Pre-construction / Post-construction / RCC); each photo gets a
// simulated AI interpretation (a suggested defect + confidence — the placeholder
// the real vision model will replace, see lib/conformanceAi) that the inspector
// Accepts or Overrides from the curated defect catalogue; results roll up into a
// grouped remediation report. A fourth tab browses the whole defect catalogue.

import React, { useMemo, useRef, useState } from 'react';
import { Camera, Upload, Sparkles, Trash2 } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import { Dialog } from '../../components/ui/Dialog';
import { ErrorBox } from '../../components/ui/ErrorBox';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { DocumentImage } from '../../components/DocumentImage';
import { useProject } from '../../components/layout/ProjectLayout';
import { getApiErrorMessage } from '../../api/client';
import { toast } from '../../lib/toast';
import { useDeleteDocument, useDocuments, useUploadDocument } from '../../queries/documents';
import { useConformanceFindings, useDeleteFinding, useUpsertFinding } from '../../queries/conformance';
import { interpretPhoto } from '../../lib/conformanceAi';
import {
  DEFECTS_BY_CODE, POST_DEFECTS, PRE_DEFECTS, taxonomyFor,
} from '../../data/defectTaxonomy';
import type { DocumentResponse } from '../../types/master';
import type { ConformanceFinding, DefectPhase, FindingSeverity } from '../../types/conformance';
import './ConformanceAnalyser.css';

type Tab = DefectPhase | 'CATALOGUE';

const PHASE_TYPE: Record<DefectPhase, string> = {
  PRE: 'CONFORMANCE_PRE', POST: 'CONFORMANCE_POST', RCC: 'CONFORMANCE_RCC',
};
const TAB_LABEL: Record<Tab, string> = {
  PRE: 'Pre-construction', POST: 'Post-construction', RCC: 'RCC Defect Analyser', CATALOGUE: 'Defect catalogue',
};

const SEVERITY_VARIANT: Record<FindingSeverity, 'info' | 'warn' | 'fail'> = {
  LOW: 'info', MED: 'warn', HIGH: 'fail',
};
const SEVERITY_LABEL: Record<FindingSeverity, string> = { LOW: 'Low', MED: 'Medium', HIGH: 'High' };
const SEVERITY_ORDER: FindingSeverity[] = ['HIGH', 'MED', 'LOW'];

const fmtDate = (iso: string): string => new Date(iso).toLocaleDateString();

const Field: React.FC<{ label: string; text: string }> = ({ label, text }) => (
  <div style={{ marginTop: 10 }}>
    <div className="qms-text-sm text-muted" style={{ fontWeight: 600 }}>{label}</div>
    <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>{text}</div>
  </div>
);

// ── Per-photo classification modal ───────────────────────────────────────────
const ClassifyModal: React.FC<{
  pid: number;
  phase: DefectPhase;
  doc: DocumentResponse;
  existing: ConformanceFinding | undefined;
  initialCode?: string;
  onClose: () => void;
}> = ({ pid, phase, doc, existing, initialCode, onClose }) => {
  const upsert = useUpsertFinding(pid);
  const [code, setCode] = useState(existing?.defect_code ?? initialCode ?? '');
  const [remediation, setRemediation] = useState<'A' | 'B' | ''>(existing?.remediation_choice ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const defect = code ? DEFECTS_BY_CODE[code] : undefined;

  const save = async () => {
    if (!defect) return;
    try {
      await upsert.mutateAsync({
        document_id: doc.document_id, phase,
        defect_code: defect.code, defect_label: defect.label, severity: defect.severity,
        remediation_choice: remediation || null, notes: notes.trim() || null,
      });
      toast.success('Classification saved.');
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not save the classification.'));
    }
  };

  const opts = [
    { label: 'Select a defect…', value: '' },
    ...taxonomyFor(phase).map((d) => ({ label: d.label, value: d.code })),
  ];

  return (
    <Dialog
      open
      onOpenChange={(o) => { if (!o) onClose(); }}
      title={`Classify — ${doc.original_filename}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={!defect || upsert.isPending}>
            {upsert.isPending ? 'Saving…' : 'Save classification'}
          </Button>
        </>
      }
    >
      <div style={{ maxHeight: '65vh', overflowY: 'auto' }}>
        <DocumentImage pid={pid} documentId={doc.document_id} className="qms-conf-modal-img" alt={doc.original_filename} />
        <Select label="Defect type" value={code} onChange={(e) => setCode(e.target.value)} options={opts} />
        {defect && (
          <div style={{ marginTop: 12 }}>
            <Badge variant={SEVERITY_VARIANT[defect.severity]}>{SEVERITY_LABEL[defect.severity]} severity</Badge>
            <Field label="Likely root cause" text={defect.rootCause} />
            <Field label="Further investigation" text={defect.furtherInvestigation} />
            <Field label="Recommended solution" text={defect.futureSolution} />
            <div className="qms-text-sm text-muted" style={{ fontWeight: 600, margin: '14px 0 6px' }}>Remediation option</div>
            <div className="qms-conf-rem-row">
              {(['A', 'B'] as const).map((opt) => {
                const r = opt === 'A' ? defect.remediationA : defect.remediationB;
                return (
                  <button
                    type="button" key={opt} aria-pressed={remediation === opt}
                    className={`qms-conf-rem ${remediation === opt ? 'is-sel' : ''}`}
                    onClick={() => setRemediation(opt)}
                  >
                    <div className="font-medium">{r.title}</div>
                    <div className="qms-text-sm text-muted">{r.scope}</div>
                    <div className="qms-text-sm text-muted">{r.costDuration}</div>
                  </button>
                );
              })}
            </div>
            <Input label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="location, extent…" />
          </div>
        )}
      </div>
    </Dialog>
  );
};

// ── Defect catalogue browser ─────────────────────────────────────────────────
const CatalogueTab: React.FC = () => {
  const [q, setQ] = useState('');
  const all = useMemo(() => [...PRE_DEFECTS, ...POST_DEFECTS], []);
  const rows = all.filter(
    (d) => !q || d.label.toLowerCase().includes(q.toLowerCase()) || d.code.includes(q.toLowerCase()),
  );
  return (
    <Card className="qms-form-section" padding="none">
      <div className="qms-card-header">
        <h3 className="qms-section-heading-plain">Defect catalogue · {all.length}</h3>
        <Input placeholder="Search defects…" value={q} onChange={(e) => setQ(e.target.value)} fullWidth={false} />
      </div>
      <div className="qms-table-container">
        <table className="qms-table">
          <thead><tr><th>Defect</th><th>Severity</th><th>Likely root cause</th><th>Remediation</th></tr></thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={4} className="text-muted">No defects match.</td></tr>
            ) : rows.map((d) => (
              <tr key={d.code}>
                <td className="font-medium">{d.label}</td>
                <td><Badge variant={SEVERITY_VARIANT[d.severity]}>{SEVERITY_LABEL[d.severity]}</Badge></td>
                <td className="qms-text-sm text-muted" style={{ maxWidth: 380 }}>{d.rootCause}</td>
                <td className="qms-text-sm" style={{ maxWidth: 280 }}>
                  <strong>A:</strong> {d.remediationA.scope}<br />
                  <strong>B:</strong> {d.remediationB.scope}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

// ── Page ─────────────────────────────────────────────────────────────────────
export const ConformanceAnalyser: React.FC = () => {
  const { project } = useProject();
  const pid = project.project_id;

  const [tab, setTab] = useState<Tab>('POST');
  const [classifying, setClassifying] = useState<{ doc: DocumentResponse; initialCode?: string } | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'number' | 'confidence' | 'defect'>('number');
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: docs = [], isPending, error } = useDocuments(pid);
  const { data: findings = [] } = useConformanceFindings(pid);
  const upload = useUploadDocument(pid);
  const upsert = useUpsertFinding(pid);
  const removeDoc = useDeleteDocument(pid);
  const removeFinding = useDeleteFinding(pid);
  const confirm = useConfirm();

  const isPhase = tab !== 'CATALOGUE';
  const phase = (isPhase ? tab : 'POST') as DefectPhase;

  const findingByDoc = useMemo(() => new Map(findings.map((f) => [f.document_id, f])), [findings]);
  const phaseFindings = findings.filter((f) => f.phase === phase);

  const items = useMemo(() => {
    const photos = docs.filter((d) => d.document_type === PHASE_TYPE[phase]);
    const list = photos.map((doc) => {
      const finding = findingByDoc.get(doc.document_id);
      const ai = interpretPhoto(`${doc.original_filename}-${doc.document_id}`, phase);
      const defect = finding ? DEFECTS_BY_CODE[finding.defect_code] : DEFECTS_BY_CODE[ai.defectCode];
      return {
        doc, finding, ai, defect,
        label: finding?.defect_label ?? defect?.label ?? '',
        severity: (finding?.severity ?? defect?.severity) as FindingSeverity | undefined,
      };
    });
    const q = search.trim().toLowerCase();
    const filtered = q
      ? list.filter((i) => i.label.toLowerCase().includes(q) || i.doc.original_filename.toLowerCase().includes(q))
      : list;
    const sorted = [...filtered];
    if (sortBy === 'confidence') sorted.sort((a, b) => b.ai.confidence - a.ai.confidence);
    else if (sortBy === 'defect') sorted.sort((a, b) => a.label.localeCompare(b.label));
    return sorted;
  }, [docs, findingByDoc, phase, search, sortBy]);

  const onPick = async (files: FileList | null) => {
    const list = files ? Array.from(files) : [];
    if (list.length === 0) return;
    try {
      for (const file of list) await upload.mutateAsync({ file, documentType: PHASE_TYPE[phase] });
      toast.success(`Uploaded ${list.length} photo${list.length > 1 ? 's' : ''}.`);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Unable to upload the photo.'));
    }
  };

  // Delete the finding first (it FK-references the photo), then the document.
  const deletePhoto = async (doc: DocumentResponse, finding: ConformanceFinding | undefined) => {
    const ok = await confirm({
      title: `Delete ${doc.original_filename}?`,
      description: 'This removes the photo and any classification on it.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      if (finding) await removeFinding.mutateAsync(finding.finding_id);
      await removeDoc.mutateAsync(doc.document_id);
      toast.success('Photo deleted.');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not delete the photo.'));
    }
  };

  const acceptAi = async (doc: DocumentResponse, defectCode: string) => {
    const defect = DEFECTS_BY_CODE[defectCode];
    if (!defect) return;
    try {
      await upsert.mutateAsync({
        document_id: doc.document_id, phase,
        defect_code: defect.code, defect_label: defect.label, severity: defect.severity,
        remediation_choice: null, notes: null,
      });
      toast.success('AI suggestion accepted.');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not save the classification.'));
    }
  };

  return (
    <div>
      <div className="qms-conf-banner">
        <Camera size={18} />
        <div>
          Upload site photos, review each photo&apos;s <strong>AI interpretation</strong> (a suggested
          defect + confidence) and <strong>Accept</strong> it or <strong>Override</strong> from the
          catalogue — building a per-phase remediation report. The AI suggestion is a simulated
          placeholder until the vision model is connected.
        </div>
      </div>

      <div className="qms-conf-tabs" role="tablist" aria-label="Section">
        {(Object.keys(TAB_LABEL) as Tab[]).map((t) => (
          <button
            key={t} type="button" role="tab" aria-selected={tab === t}
            className={`qms-conf-tab ${tab === t ? 'is-active' : ''}`}
            onClick={() => setTab(t)}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      {tab === 'CATALOGUE' ? (
        <CatalogueTab />
      ) : (
        <>
          {error && <ErrorBox>{getApiErrorMessage(error, 'Unable to load photos.')}</ErrorBox>}

          <Card className="qms-form-section">
            <label className="qms-conf-drop">
              <Upload size={20} />
              <span className="font-medium">Upload {TAB_LABEL[phase].toLowerCase()} photos</span>
              <span className="qms-text-sm text-muted">JPG, PNG or WEBP · you can select several at once</span>
              <input
                ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden
                onChange={(e) => onPick(e.target.files)}
              />
            </label>
            {upload.isPending && <p className="qms-text-sm text-muted" style={{ marginTop: 8 }}>Uploading…</p>}
          </Card>

          <Card className="qms-form-section" padding="none">
            <div className="qms-card-header">
              <h3 className="qms-section-heading-plain">
                {TAB_LABEL[phase]} photos{items.length > 0 && <span className="text-muted"> · {items.length}</span>}
              </h3>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} fullWidth={false} />
                <Select
                  label="Sort by" fullWidth={false} value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  options={[
                    { label: 'Upload order', value: 'number' },
                    { label: 'AI confidence', value: 'confidence' },
                    { label: 'Defect name', value: 'defect' },
                  ]}
                />
              </div>
            </div>
            {isPending ? (
              <p className="text-muted qms-text-sm" style={{ padding: 16 }}>Loading…</p>
            ) : items.length === 0 ? (
              <p className="text-muted qms-text-sm" style={{ padding: 16 }}>
                No {TAB_LABEL[phase].toLowerCase()} photos {search ? 'match.' : 'uploaded yet.'}
              </p>
            ) : (
              <div className="qms-conf-grid">
                {items.map(({ doc, finding, ai }) => (
                  <div key={doc.document_id} className="qms-conf-photo">
                    <DocumentImage pid={pid} documentId={doc.document_id} className="qms-conf-photo-thumb" alt={doc.original_filename} />
                    <div className="qms-conf-photo-meta">
                      <div className="font-medium qms-conf-photo-name" title={doc.original_filename}>{doc.original_filename}</div>
                      <div className="qms-text-sm text-muted">{doc.uploaded_by_name ?? '—'} · {fmtDate(doc.uploaded_at)}</div>
                      {finding ? (
                        <div className="qms-conf-photo-actions">
                          <Badge variant={SEVERITY_VARIANT[finding.severity]}>{finding.defect_label}</Badge>
                          <button type="button" className="qms-conf-link" onClick={() => setClassifying({ doc, initialCode: finding.defect_code })}>Reclassify</button>
                        </div>
                      ) : (
                        <>
                          <div className="qms-conf-ai" title="Simulated — replaced by the real model later">
                            <Sparkles size={12} /> AI: {DEFECTS_BY_CODE[ai.defectCode]?.label} · {ai.confidence}%
                          </div>
                          <div className="qms-conf-photo-actions">
                            <Button size="sm" onClick={() => acceptAi(doc, ai.defectCode)}>Accept</Button>
                            <Button size="sm" variant="outline" onClick={() => setClassifying({ doc, initialCode: ai.defectCode })}>Override</Button>
                          </div>
                        </>
                      )}
                      <button type="button" className="qms-conf-delete" onClick={() => deletePhoto(doc, finding)}>
                        <Trash2 size={12} /> Delete photo
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {phaseFindings.length > 0 && (
            <Card className="qms-form-section">
              <h3 className="qms-section-heading-plain qms-mb-12">Remediation report · {TAB_LABEL[phase]}</h3>
              {SEVERITY_ORDER.map((sev) => {
                const group = phaseFindings.filter((f) => f.severity === sev);
                if (group.length === 0) return null;
                return (
                  <div key={sev} className="qms-conf-report-group">
                    <Badge variant={SEVERITY_VARIANT[sev]}>{SEVERITY_LABEL[sev]} severity · {group.length}</Badge>
                    <ul className="qms-conf-report-list">
                      {group.map((f) => {
                        const def = DEFECTS_BY_CODE[f.defect_code];
                        const rem = f.remediation_choice === 'B' ? def?.remediationB : def?.remediationA;
                        return (
                          <li key={f.finding_id}>
                            <span className="font-medium">{f.defect_label}</span>
                            {f.remediation_choice && rem
                              ? <span className="text-muted"> — {rem.title}: {rem.scope}</span>
                              : <span className="text-muted"> — remediation not yet chosen</span>}
                            {f.notes ? <span className="text-muted"> · {f.notes}</span> : null}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </Card>
          )}
        </>
      )}

      {classifying && (
        <ClassifyModal
          pid={pid}
          phase={phase}
          doc={classifying.doc}
          existing={findingByDoc.get(classifying.doc.document_id)}
          initialCode={classifying.initialCode}
          onClose={() => setClassifying(null)}
        />
      )}
    </div>
  );
};
