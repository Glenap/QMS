// The global code-standard selector for the Analytics page. Picks the design
// code the analytics are read under (IS is the only implemented standard; ACI is
// selectable but hides the analytics). Also a compact manager for the reference
// code PDFs (IS 456 / IS 10262) that the per-chart clause tags link to — any
// project member can attach or replace them.

import React, { useRef, useState } from 'react';
import { FileText, Upload } from 'lucide-react';
import { Select } from '../ui/Select';
import { documentsApi } from '../../api/documents';
import { useUploadDocument } from '../../queries/documents';
import { getApiErrorMessage } from '../../api/client';
import { toast } from '../../lib/toast';
import { CODE_PDF_SLOTS, CODE_STANDARD_OPTIONS, type CodeStandard } from '../../lib/codeStandards';
import type { DocumentResponse } from '../../types/document';

interface Props {
  pid: number;
  code: CodeStandard;
  onCode: (c: CodeStandard) => void;
  documents: DocumentResponse[];
}

const PdfSlot: React.FC<{ pid: number; docType: string; label: string; documents: DocumentResponse[] }> = ({
  pid, docType, label, documents,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadDocument(pid);
  const doc = documents
    .filter((d) => d.document_type === docType)
    .sort((a, b) => b.document_id - a.document_id)[0];

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    upload.mutate(
      { file, documentType: docType, title: `${label} (code standard)` },
      {
        onSuccess: () => toast.success(`${label} PDF attached.`),
        onError: (err) => toast.error(getApiErrorMessage(err, `Could not upload the ${label} PDF.`)),
      },
    );
  };

  const view = () => {
    if (!doc) return;
    documentsApi.view(pid, doc.document_id).catch((err) => {
      toast.error(getApiErrorMessage(err, 'Could not open the code PDF.'));
    });
  };

  return (
    <div className="qms-code-slot">
      <span className="qms-code-slot-label">{label}</span>
      {doc ? (
        <button type="button" className="qms-clause-pdf" onClick={view}>
          <FileText size={12} /> View
        </button>
      ) : (
        <span className="qms-code-slot-none">not attached</span>
      )}
      <button
        type="button"
        className="qms-code-slot-upload"
        onClick={() => inputRef.current?.click()}
        disabled={upload.isPending}
      >
        <Upload size={12} /> {doc ? 'Replace' : 'Upload'}
      </button>
      <input ref={inputRef} type="file" accept="application/pdf" hidden onChange={onPick} />
    </div>
  );
};

export const CodeStandardBar: React.FC<Props> = ({ pid, code, onCode, documents }) => {
  const [showPdfs, setShowPdfs] = useState(false);
  return (
    <div className="qms-code-bar">
      <Select
        label="Code standard"
        fullWidth={false}
        value={code}
        onChange={(e) => onCode(e.target.value as CodeStandard)}
        options={CODE_STANDARD_OPTIONS}
      />
      <div className="qms-code-bar-pdfs">
        <button type="button" className="qms-code-toggle" onClick={() => setShowPdfs((s) => !s)}>
          {showPdfs ? 'Hide code PDFs' : 'Code PDFs'}
        </button>
        {showPdfs && (
          <div className="qms-code-slots">
            {CODE_PDF_SLOTS.map((s) => (
              <PdfSlot key={s.docType} pid={pid} docType={s.docType} label={s.label} documents={documents} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
