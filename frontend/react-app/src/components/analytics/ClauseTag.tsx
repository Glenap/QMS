// A small citation shown next to an analytics chart: which code clause the
// analytic is drawn from, with a "View PDF" link that opens the uploaded
// reference standard (if one has been attached for this project). IS basis only —
// the whole Analytics body is hidden when the ACI standard is selected.

import React from 'react';
import { FileText, Info } from 'lucide-react';
import { documentsApi } from '../../api/documents';
import { getApiErrorMessage } from '../../api/client';
import { toast } from '../../lib/toast';
import { CLAUSES } from '../../lib/codeStandards';
import type { DocumentResponse } from '../../types/document';

interface Props {
  pid: number;
  clause: keyof typeof CLAUSES;
  documents: DocumentResponse[];
}

export const ClauseTag: React.FC<Props> = ({ pid, clause, documents }) => {
  const c = CLAUSES[clause];
  // Latest uploaded reference PDF for this clause's standard, if any.
  const doc = documents
    .filter((d) => d.document_type === c.docType)
    .sort((a, b) => b.document_id - a.document_id)[0];

  const view = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!doc) return;
    // Must run in the click gesture (popup blocker) — not via a mutation.
    documentsApi.view(pid, doc.document_id).catch((err) => {
      toast.error(getApiErrorMessage(err, 'Could not open the code PDF.'));
    });
  };

  return (
    <span className="qms-clause-tag">
      <Info size={12} />
      <span className="qms-clause-code">{c.code}</span>
      <span className="qms-clause-ref">{c.ref}</span>
      {doc && (
        <button type="button" className="qms-clause-pdf" onClick={view}>
          <FileText size={12} /> View PDF
        </button>
      )}
    </span>
  );
};
