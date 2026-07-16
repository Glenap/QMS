// Conformance Analyser — upload site photos for automated defect detection,
// split into pre-construction and post-construction phases. The ML model that
// classifies the defect type from a photo is still being prepared; for now this
// captures and stores the photos (via the project document store) so the model
// can process them once it's live. Uploads are tagged CONFORMANCE_PRE / _POST.

import React, { useRef, useState } from 'react';
import { Camera, Image as ImageIcon, Upload } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { ErrorBox } from '../../components/ui/ErrorBox';
import { useProject } from '../../components/layout/ProjectLayout';
import { getApiErrorMessage } from '../../api/client';
import { toast } from '../../lib/toast';
import { useDocuments, useDownloadDocument, useUploadDocument } from '../../queries/documents';
import type { DocumentResponse } from '../../types/master';
import './ConformanceAnalyser.css';

type Phase = 'PRE' | 'POST';

const PHASE_TYPE: Record<Phase, string> = {
  PRE: 'CONFORMANCE_PRE',
  POST: 'CONFORMANCE_POST',
};

const PHASE_LABEL: Record<Phase, string> = {
  PRE: 'Pre-construction',
  POST: 'Post-construction',
};

const fmtDate = (iso: string): string => new Date(iso).toLocaleDateString();

export const ConformanceAnalyser: React.FC = () => {
  const { project } = useProject();
  const pid = project.project_id;

  const [phase, setPhase] = useState<Phase>('PRE');
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: docs = [], isPending, error } = useDocuments(pid);
  const upload = useUploadDocument(pid);
  const download = useDownloadDocument(pid);

  const photos = docs.filter((d) => d.document_type === PHASE_TYPE[phase]);

  const onPick = async (files: FileList | null) => {
    const list = files ? Array.from(files) : [];
    if (list.length === 0) return;
    try {
      for (const file of list) {
        await upload.mutateAsync({ file, documentType: PHASE_TYPE[phase] });
      }
      toast.success(`Uploaded ${list.length} photo${list.length > 1 ? 's' : ''}.`);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Unable to upload the photo.'));
    }
  };

  const onDownload = async (doc: DocumentResponse) => {
    try {
      await download.mutateAsync(doc);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Unable to download the photo.'));
    }
  };

  return (
    <div>
      <div className="qms-conf-banner">
        <Camera size={18} />
        <div>
          <strong>Defect analysis is being prepared.</strong> Upload site photos below —
          they&apos;re stored per phase so the analyser can classify the defect type once
          the model is live.
        </div>
      </div>

      <div className="qms-conf-tabs" role="tablist" aria-label="Construction phase">
        {(Object.keys(PHASE_LABEL) as Phase[]).map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={phase === p}
            className={`qms-conf-tab ${phase === p ? 'is-active' : ''}`}
            onClick={() => setPhase(p)}
          >
            {PHASE_LABEL[p]}
          </button>
        ))}
      </div>

      {error && <ErrorBox>{getApiErrorMessage(error, 'Unable to load photos.')}</ErrorBox>}

      <Card className="qms-form-section">
        <label className="qms-conf-drop">
          <Upload size={20} />
          <span className="font-medium">Upload {PHASE_LABEL[phase].toLowerCase()} photos</span>
          <span className="qms-text-sm text-muted">JPG, PNG or WEBP · you can select several at once</span>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            hidden
            onChange={(e) => onPick(e.target.files)}
          />
        </label>
        {upload.isPending && <p className="qms-text-sm text-muted" style={{ marginTop: 8 }}>Uploading…</p>}
      </Card>

      <Card className="qms-form-section" padding="none">
        <div className="qms-card-header">
          <h3 className="qms-section-heading-plain">
            {PHASE_LABEL[phase]} photos
            {photos.length > 0 && <span className="text-muted"> · {photos.length}</span>}
          </h3>
        </div>
        {isPending ? (
          <p className="text-muted qms-text-sm" style={{ padding: 16 }}>Loading…</p>
        ) : photos.length === 0 ? (
          <p className="text-muted qms-text-sm" style={{ padding: 16 }}>
            No {PHASE_LABEL[phase].toLowerCase()} photos uploaded yet.
          </p>
        ) : (
          <div className="qms-conf-grid">
            {photos.map((d) => (
              <div key={d.document_id} className="qms-conf-photo">
                <div className="qms-conf-photo-thumb"><ImageIcon size={28} /></div>
                <div className="qms-conf-photo-meta">
                  <div className="font-medium qms-conf-photo-name" title={d.original_filename}>{d.original_filename}</div>
                  <div className="qms-text-sm text-muted">{d.uploaded_by_name ?? '—'} · {fmtDate(d.uploaded_at)}</div>
                  <div className="qms-conf-photo-actions">
                    <Badge variant="pending">Analysis pending</Badge>
                    <button type="button" className="qms-conf-link" onClick={() => onDownload(d)}>Download</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
