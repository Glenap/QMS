// Documents API — project-scoped wrappers over /projects/{id}/documents.
// See backend/app/routers/documents.py.
//
// Upload is multipart/form-data: axios v1 detects the FormData body and sets the
// correct Content-Type (with boundary) itself, overriding the JSON default on the
// shared client. Download fetches the blob through `api` (so the bearer token is
// attached) and saves it client-side.

import { api } from './client';
import type { DocumentResponse, DocumentReview } from '../types/master';

export const documentsApi = {
  list(projectId: number): Promise<DocumentResponse[]> {
    return api
      .get<DocumentResponse[]>(`/projects/${projectId}/documents`)
      .then((r) => r.data);
  },

  upload(
    projectId: number,
    file: File,
    opts: { documentType?: string; title?: string } = {},
  ): Promise<DocumentResponse> {
    const form = new FormData();
    form.append('file', file);
    if (opts.documentType) form.append('document_type', opts.documentType);
    if (opts.title) form.append('title', opts.title);
    return api
      .post<DocumentResponse>(`/projects/${projectId}/documents`, form)
      .then((r) => r.data);
  },

  async download(projectId: number, doc: DocumentResponse): Promise<void> {
    const res = await api.get(
      `/projects/${projectId}/documents/${doc.document_id}/download`,
      { responseType: 'blob' },
    );
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.original_filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  // Open a document inline in a new browser tab (PDFs render in the built-in
  // viewer). The download needs the bearer token, so we can't just link to the
  // URL — we fetch the blob. To avoid the popup blocker (which blocks a
  // window.open that happens after an await), the tab is opened SYNCHRONOUSLY in
  // the caller's click, then pointed at the blob once it loads. Call this
  // directly from the event handler, not via an async wrapper.
  view(projectId: number, documentId: number): Promise<void> {
    const tab = window.open('about:blank', '_blank');
    return api
      .get(`/projects/${projectId}/documents/${documentId}/download`, { responseType: 'blob' })
      .then((res) => {
        const blob = new Blob([res.data as BlobPart], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        if (tab) {
          tab.location.href = url;
        } else {
          // Popup blocked — fall back to a download.
          const a = document.createElement('a');
          a.href = url;
          a.target = '_blank';
          a.rel = 'noopener';
          a.click();
        }
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      })
      .catch((err) => {
        if (tab) tab.close();
        throw err;
      });
  },

  // Fetch a document's bytes (bearer-authed) as an object URL — for rendering an
  // image inline (<img src>) since the download URL itself can't carry the token.
  // The caller MUST URL.revokeObjectURL it when done.
  async objectUrl(projectId: number, documentId: number): Promise<string> {
    const res = await api.get(
      `/projects/${projectId}/documents/${documentId}/download`,
      { responseType: 'blob' },
    );
    return URL.createObjectURL(res.data as Blob);
  },

  remove(projectId: number, documentId: number): Promise<void> {
    return api
      .delete(`/projects/${projectId}/documents/${documentId}`)
      .then(() => undefined);
  },

  // QE / PM approves or rejects a document.
  review(
    projectId: number,
    documentId: number,
    data: DocumentReview,
  ): Promise<DocumentResponse> {
    return api
      .patch<DocumentResponse>(`/projects/${projectId}/documents/${documentId}/review`, data)
      .then((r) => r.data);
  },
};
