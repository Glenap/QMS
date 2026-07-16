// React Query hooks for the NCR feature — the reference adoption of
// @tanstack/react-query in this app. Reads use `useQuery`; lifecycle changes use
// `useMutation` and invalidate the affected query keys, so the list (counts /
// status) and the open detail panel refresh themselves without manual `load()`
// calls or `onChanged` prop-drilling.

import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ncrsApi } from '../../api/ncrs';
import { aiSuggestionsApi } from '../../api/aiSuggestions';
import type {
  AISuggestionResponse,
  CorrectiveActionCreate,
  CorrectiveActionUpdate,
  NcrNotifyRmc,
  NCRUpdate,
  RetestCreate,
  RetestResultUpdate,
} from '../../types/master';

// ── Query keys (one source of truth for cache reads + invalidation) ────────────
export const ncrKeys = {
  list: (pid: number) => ['ncrs', pid] as const,
  detail: (pid: number, ncrId: number) => ['ncr', pid, ncrId] as const,
  suggestion: (pid: number, ncrId: number) => ['ncr-suggestion', pid, ncrId] as const,
  pattern: (pid: number, ncrId: number) => ['ncr-pattern', pid, ncrId] as const,
  retests: (pid: number) => ['retests', pid] as const,
};

// ── Reads ──────────────────────────────────────────────────────────────────────

export const useNcrList = (pid: number) =>
  useQuery({
    queryKey: ncrKeys.list(pid),
    queryFn: () => ncrsApi.list(pid),
  });

export const useNcrDetail = (pid: number, ncrId: number) =>
  useQuery({
    queryKey: ncrKeys.detail(pid, ncrId),
    queryFn: () => ncrsApi.get(pid, ncrId),
  });

// A 404 means "no suggestion generated yet" — resolve to null rather than erroring.
export const useNcrSuggestion = (pid: number, ncrId: number) =>
  useQuery<AISuggestionResponse | null>({
    queryKey: ncrKeys.suggestion(pid, ncrId),
    queryFn: async () => {
      try {
        return await aiSuggestionsApi.get(pid, ncrId);
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 404) return null;
        throw err;
      }
    },
  });

// Deterministic recurring-failure insight for this NCR's RMC + grade.
export const useNcrPattern = (pid: number, ncrId: number) =>
  useQuery({
    queryKey: ncrKeys.pattern(pid, ncrId),
    queryFn: () => ncrsApi.pattern(pid, ncrId),
  });

// Every NDT/core retest across the project (the Retests page).
export const useProjectRetests = (pid: number) =>
  useQuery({
    queryKey: ncrKeys.retests(pid),
    queryFn: () => ncrsApi.listRetests(pid),
  });

// ── Mutations ───────────────────────────────────────────────────────────────────
// Each invalidates the detail (this NCR) and the list (counts/status) so both the
// open panel and the table reflect the change.

const useNcrMutation = <TArgs, TResult>(
  pid: number,
  ncrId: number,
  fn: (args: TArgs) => Promise<TResult>,
) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ncrKeys.detail(pid, ncrId) });
      void qc.invalidateQueries({ queryKey: ncrKeys.list(pid) });
    },
  });
};

export const useUpdateNcr = (pid: number, ncrId: number) =>
  useNcrMutation(pid, ncrId, (data: NCRUpdate) => ncrsApi.update(pid, ncrId, data));

export const useAddCorrectiveAction = (pid: number, ncrId: number) =>
  useNcrMutation(pid, ncrId, (data: CorrectiveActionCreate) =>
    ncrsApi.addCorrectiveAction(pid, ncrId, data));

export const useUpdateCorrectiveAction = (pid: number, ncrId: number) =>
  useNcrMutation(pid, ncrId, (vars: { actionId: number; data: CorrectiveActionUpdate }) =>
    ncrsApi.updateCorrectiveAction(pid, ncrId, vars.actionId, vars.data));

// Retest + RMC-notify mutations also refresh the project-wide Retests page and
// the open detail panel (which lists retests / notifications inline).
const useNcrRetestMutation = <TArgs, TResult>(
  pid: number,
  ncrId: number,
  fn: (args: TArgs) => Promise<TResult>,
) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ncrKeys.detail(pid, ncrId) });
      void qc.invalidateQueries({ queryKey: ncrKeys.list(pid) });
      void qc.invalidateQueries({ queryKey: ncrKeys.retests(pid) });
    },
  });
};

export const useOrderRetest = (pid: number, ncrId: number) =>
  useNcrRetestMutation(pid, ncrId, (data: RetestCreate) =>
    ncrsApi.orderRetest(pid, ncrId, data));

export const useRecordRetest = (pid: number, ncrId: number) =>
  useNcrRetestMutation(
    pid,
    ncrId,
    (vars: { retestId: number; data: RetestResultUpdate }) =>
      ncrsApi.recordRetestResult(pid, ncrId, vars.retestId, vars.data),
  );

export const useNotifyRmc = (pid: number, ncrId: number) =>
  useNcrMutation(pid, ncrId, (data: NcrNotifyRmc) => ncrsApi.notifyRmc(pid, ncrId, data));

export const useGenerateSuggestion = (pid: number, ncrId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => aiSuggestionsApi.generate(pid, ncrId),
    onSuccess: (data) => qc.setQueryData(ncrKeys.suggestion(pid, ncrId), data),
  });
};

export const useApplySuggestion = (pid: number, ncrId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => aiSuggestionsApi.apply(pid, ncrId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ncrKeys.detail(pid, ncrId) });
      void qc.invalidateQueries({ queryKey: ncrKeys.list(pid) });
    },
  });
};
