import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { documentsApi } from '../api/documents';
import type { DocumentResponse, DocumentReview } from '../types/master';

export const documentKeys = { list: (pid: number) => ['documents', pid] as const };

export const useDocuments = (pid: number) =>
  useQuery({ queryKey: documentKeys.list(pid), queryFn: () => documentsApi.list(pid) });

export const useUploadDocument = (pid: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { file: File; documentType?: string; title?: string }) =>
      documentsApi.upload(pid, vars.file, { documentType: vars.documentType, title: vars.title }),
    onSuccess: () => qc.invalidateQueries({ queryKey: documentKeys.list(pid) }),
  });
};

export const useDeleteDocument = (pid: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (documentId: number) => documentsApi.remove(pid, documentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: documentKeys.list(pid) }),
  });
};

export const useReviewDocument = (pid: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { documentId: number; data: DocumentReview }) =>
      documentsApi.review(pid, vars.documentId, vars.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: documentKeys.list(pid) }),
  });
};

// Side-effecting browser download (no cache) — a mutation gives per-row pending.
export const useDownloadDocument = (pid: number) =>
  useMutation({ mutationFn: (doc: DocumentResponse) => documentsApi.download(pid, doc) });

// NOTE: opening a document inline (documentsApi.view) is called DIRECTLY from a
// click handler, not via a mutation — window.open must run in the user gesture
// to dodge the popup blocker.
