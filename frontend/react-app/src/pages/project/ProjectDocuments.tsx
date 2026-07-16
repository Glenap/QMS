import React, { useRef, useState } from 'react';
import { Upload, Download, Trash2, FileText, Search, Check, X } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { ErrorBox } from '../../components/ui/ErrorBox';
import { useProject } from '../../components/layout/ProjectLayout';
import { getApiErrorMessage } from '../../api/client';
import { toast } from '../../lib/toast';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import {
  useDeleteDocument,
  useDocuments,
  useDownloadDocument,
  useReviewDocument,
  useUploadDocument,
} from '../../queries/documents';
import type { DocumentApprovalStatus, DocumentResponse } from '../../types/master';
import './ProjectDocuments.css';

const APPROVAL_VARIANT: Record<DocumentApprovalStatus, 'pass' | 'fail' | 'pending'> = {
  APPROVED: 'pass', REJECTED: 'fail', PENDING: 'pending',
};
const APPROVAL_LABEL: Record<DocumentApprovalStatus, string> = {
  APPROVED: 'Approved', REJECTED: 'Rejected', PENDING: 'Pending review',
};

const CATEGORY_OPTIONS = [
  { label: 'No category', value: '' },
  { label: 'Drawing', value: 'DRAWING' },
  { label: 'Mix design', value: 'MIX_DESIGN' },
  { label: 'RMC detail', value: 'RMC_DETAIL' },
  { label: 'Pour record', value: 'POUR_RECORD' },
  { label: 'Grade detail', value: 'GRADE_DETAIL' },
  { label: 'Cube test register', value: 'CUBE_TEST_REGISTER' },
  { label: 'Other', value: 'OTHER' },
];

const fmtSize = (b: number): string =>
  b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;

const catLabel = (c: string | null): string =>
  c ? c.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase()) : '—';

const fmtDate = (iso: string): string => new Date(iso).toLocaleDateString();

export const ProjectDocuments: React.FC = () => {
  const { project } = useProject();
  const pid = project.project_id;
  const canManage =
    project.access.can_manage_client_side || project.access.can_manage_contractor_side;

  const canReview = project.access.project_role === 'QUALITY_ENGINEER' || project.access.project_role === 'PROJECT_MANAGER';

  const { data: rows = [], isPending, error: loadError } = useDocuments(pid);
  const upload = useUploadDocument(pid);
  const download = useDownloadDocument(pid);
  const remove = useDeleteDocument(pid);
  const review = useReviewDocument(pid);
  const confirm = useConfirm();

  const handleReview = async (doc: DocumentResponse, status: DocumentApprovalStatus) => {
    let reason: string | null = null;
    if (status === 'REJECTED') {
      const ok = await confirm({
        title: 'Reject document?',
        description: `“${doc.original_filename}” will be marked rejected. Downstream steps can't rely on it until it's approved.`,
        confirmLabel: 'Reject',
        danger: true,
      });
      if (!ok) return;
      reason = 'Rejected on review';
    }
    try {
      await review.mutateAsync({ documentId: doc.document_id, data: { approval_status: status, rejection_reason: reason } });
      toast.success(`Document ${status.toLowerCase()}.`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not update the document.'));
    }
  };

  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [fileName, setFileName] = useState('');
  const [category, setCategory] = useState('');
  const [title, setTitle] = useState('');

  // Drawing comparison — two PDFs in, a highlighted diff out. The comparison
  // model is still being prepared, so the button is live but only signals intent
  // for now; the backend diff will be wired in once the model ships.
  const [drawAName, setDrawAName] = useState('');
  const [drawBName, setDrawBName] = useState('');
  const handleCompare = (e: React.FormEvent) => {
    e.preventDefault();
    toast.info('Drawing comparison is being prepared — it will highlight what changed between the two drawings once the model is live.');
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    try {
      const doc = await upload.mutateAsync({
        file,
        documentType: category || undefined,
        title: title.trim() || undefined,
      });
      toast.success(`Uploaded “${doc.original_filename}”.`);
      setCategory('');
      setTitle('');
      setFileName('');
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Unable to upload the file.'));
    }
  };

  const handleDownload = async (doc: DocumentResponse) => {
    try {
      await download.mutateAsync(doc);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Unable to download the file.'));
    }
  };

  const handleDelete = async (doc: DocumentResponse) => {
    if (!(await confirm({
      title: 'Delete file?',
      description: `“${doc.original_filename}” will be permanently removed. This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    }))) return;
    try {
      await remove.mutateAsync(doc.document_id);
      toast.success(`Deleted “${doc.original_filename}”.`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Unable to delete the file.'));
    }
  };

  const busy = (id: number) =>
    (download.isPending && download.variables?.document_id === id) ||
    (remove.isPending && remove.variables === id);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? rows.filter(
        (d) =>
          d.original_filename.toLowerCase().includes(q) ||
          (d.title ?? '').toLowerCase().includes(q),
      )
    : rows;

  return (
    <div>
      {loadError && <ErrorBox>{getApiErrorMessage(loadError, 'Unable to load documents.')}</ErrorBox>}

      <Card className="qms-form-section">
        <h3 className="qms-section-heading-plain qms-mb-12">Upload a document</h3>
        <form onSubmit={handleUpload} className="qms-grid-2">
          <div>
            <label htmlFor="doc-file" className="qms-input-label">File</label>
            <label className="qms-file-btn">
              <Upload size={16} />
              <span className="qms-file-btn-text">
                {fileName ? fileName.split(/[\\/]/).pop() : 'Choose a file…'}
              </span>
              <input
                id="doc-file"
                ref={fileRef}
                type="file"
                hidden
                onChange={(e) => setFileName(e.target.value)}
                accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.csv,.xls,.xlsx,.doc,.docx,.txt"
              />
            </label>
          </div>
          <Select
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            options={CATEGORY_OPTIONS}
          />
          <Input
            label="Title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Approved M30 mix certificate"
          />
          <div className="qms-field-end">
            <Button type="submit" variant="primary" disabled={upload.isPending || !fileName} icon={<Upload size={16} />}>
              {upload.isPending ? 'Uploading…' : 'Upload'}
            </Button>
          </div>
        </form>
        <p className="text-muted qms-doc-hint">
          PDF, images, spreadsheets and documents up to 25 MB.
        </p>
      </Card>

      {category === 'DRAWING' && (
        <Card className="qms-form-section">
          <h3 className="qms-section-heading-plain qms-mb-12">Compare two drawings</h3>
          <p className="text-muted qms-doc-hint" style={{ marginTop: 0, marginBottom: 12 }}>
            Upload two PDF drawings (e.g. a revision and its predecessor) to highlight what
            changed. The comparison model is being prepared — this will light up soon.
          </p>
          <form onSubmit={handleCompare} className="qms-grid-2">
            <div>
              <div className="qms-input-label">Drawing A (PDF)</div>
              <label className="qms-file-btn">
                <Upload size={16} />
                <span className="qms-file-btn-text">{drawAName ? drawAName.split(/[\\/]/).pop() : 'Choose drawing A…'}</span>
                <input type="file" accept="application/pdf" hidden onChange={(e) => setDrawAName(e.target.value)} />
              </label>
            </div>
            <div>
              <div className="qms-input-label">Drawing B (PDF)</div>
              <label className="qms-file-btn">
                <Upload size={16} />
                <span className="qms-file-btn-text">{drawBName ? drawBName.split(/[\\/]/).pop() : 'Choose drawing B…'}</span>
                <input type="file" accept="application/pdf" hidden onChange={(e) => setDrawBName(e.target.value)} />
              </label>
            </div>
            <div className="qms-field-end">
              <Button type="submit" variant="outline" disabled={!drawAName || !drawBName} icon={<Search size={16} />}>
                Compare drawings
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="qms-form-section" padding="none">
        <div className="qms-card-header">
          <h3 className="qms-section-heading-plain">Documents</h3>
          <div className="qms-search-box">
            <Search size={15} className="qms-search-icon" />
            <input
              type="text"
              aria-label="Search documents by file or title"
              placeholder="Search by file or title…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="qms-table-container">
          <table className="qms-table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Category</th>
                <th>Status</th>
                <th>Size</th>
                <th>Uploaded by</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isPending ? (
                <tr><td colSpan={7} className="text-muted">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-muted">{rows.length === 0 ? 'No documents yet.' : 'No matches.'}</td></tr>
              ) : (
                filtered.map((d) => (
                  <tr key={d.document_id}>
                    <td>
                      <div className="qms-doc-name">
                        <FileText size={16} className="text-muted" />
                        <div>
                          <div className="font-medium">{d.title || d.original_filename}</div>
                          {d.title && <div className="qms-doc-id text-muted">{d.original_filename}</div>}
                        </div>
                      </div>
                    </td>
                    <td>{d.document_type ? <Badge variant="default">{catLabel(d.document_type)}</Badge> : '—'}</td>
                    <td>
                      <Badge variant={APPROVAL_VARIANT[d.approval_status]}>{APPROVAL_LABEL[d.approval_status]}</Badge>
                      {d.approval_status === 'REJECTED' && d.rejection_reason && (
                        <div className="qms-doc-id text-muted">{d.rejection_reason}</div>
                      )}
                    </td>
                    <td>{fmtSize(d.size_bytes)}</td>
                    <td>{d.uploaded_by_name ?? '—'}</td>
                    <td>{fmtDate(d.uploaded_at)}</td>
                    <td>
                      <div className="qms-cell-actions">
                        {canReview && d.approval_status !== 'APPROVED' && (
                          <button
                            type="button"
                            className="qms-icon-btn"
                            aria-label={`Approve ${d.original_filename}`}
                            title="Approve"
                            disabled={review.isPending}
                            onClick={() => handleReview(d, 'APPROVED')}
                          >
                            <Check size={16} />
                          </button>
                        )}
                        {canReview && d.approval_status !== 'REJECTED' && (
                          <button
                            type="button"
                            className="qms-icon-btn"
                            aria-label={`Reject ${d.original_filename}`}
                            title="Reject"
                            disabled={review.isPending}
                            onClick={() => handleReview(d, 'REJECTED')}
                          >
                            <X size={16} />
                          </button>
                        )}
                        <button
                          type="button"
                          className="qms-icon-btn"
                          aria-label={`Download ${d.original_filename}`}
                          title="Download"
                          disabled={busy(d.document_id)}
                          onClick={() => handleDownload(d)}
                        >
                          <Download size={16} />
                        </button>
                        {canManage && (
                          <button
                            type="button"
                            className="qms-icon-btn"
                            aria-label={`Delete ${d.original_filename}`}
                            title="Delete"
                            disabled={busy(d.document_id)}
                            onClick={() => handleDelete(d)}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
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
