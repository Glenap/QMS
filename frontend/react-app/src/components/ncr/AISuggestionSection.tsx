import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, ShieldAlert, Sparkles, TrendingDown, Wand2 } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { getApiErrorMessage } from '../../api/client';
import { CONFIDENCE_BADGE } from './ncrFormat';
import { ErrorBox } from '../ui/ErrorBox';
import {
  useApplySuggestion,
  useGenerateSuggestion,
  useNcrPattern,
  useNcrSuggestion,
} from './queries';

interface AIProps {
  pid: number;
  ncrId: number;
  isQE: boolean;
  isClosed: boolean;
}

export const AISuggestionSection: React.FC<AIProps> = ({ pid, ncrId, isQE, isClosed }) => {
  const suggestionQuery = useNcrSuggestion(pid, ncrId);
  const suggestion = suggestionQuery.data;
  const { data: pattern } = useNcrPattern(pid, ncrId);
  const generate = useGenerateSuggestion(pid, ncrId);
  const apply = useApplySuggestion(pid, ncrId);
  const busy = generate.isPending || apply.isPending;

  const [showSources, setShowSources] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const error = actionError
    ?? (suggestionQuery.error ? getApiErrorMessage(suggestionQuery.error, 'Unable to load the AI suggestion.') : null);

  const onGenerate = async () => {
    setActionError(null);
    try {
      await generate.mutateAsync();
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'Could not generate a suggestion.'));
    }
  };

  // Auto-surface: generate the suggestion once when a QE opens an NCR that has
  // none yet (guarded by a ref so it fires a single time, and only after the
  // initial fetch has settled to "no suggestion").
  const autofired = useRef(false);
  useEffect(() => {
    if (
      isQE && !isClosed
      && suggestionQuery.isFetched
      && suggestion === null
      && !autofired.current
      && !generate.isPending
    ) {
      autofired.current = true;
      void onGenerate();
    }
  }, [isQE, isClosed, suggestionQuery.isFetched, suggestion]); // eslint-disable-line react-hooks/exhaustive-deps

  const onApply = async () => {
    setActionError(null);
    try {
      await apply.mutateAsync();
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'Could not apply the suggestion.'));
    }
  };

  const patternSignal = !!pattern && (
    pattern.supplier_grade_ncr_count > 1
    || pattern.supplier_ncr_count > 1
    || pattern.recurring_low_28d_count > 1
  );

  // Nothing to show for non-QE viewers until there's a suggestion, a meaningful
  // pattern, or an error to surface.
  if (!isQE && !suggestion && !patternSignal && !error) return null;

  const conf = suggestion?.confidence_level ? CONFIDENCE_BADGE[suggestion.confidence_level] : null;

  return (
    <div className="qms-ai-suggestion">
      <div className="qms-ai-suggestion-head">
        <h4 className="qms-section-heading qms-ai-title">
          <Sparkles size={15} className="text-primary" /> AI suggestion
        </h4>
        {isQE && (
          <Button
            size="sm"
            variant="outline"
            icon={<Wand2 size={14} />}
            disabled={busy}
            onClick={onGenerate}
          >
            {generate.isPending ? 'Analysing…' : suggestion ? 'Regenerate' : 'Suggest root cause & actions'}
          </Button>
        )}
      </div>

      {/* Deterministic recurring-failure insight (independent of the LLM) */}
      {pattern && (patternSignal || suggestion) && (
        <div className={`qms-ai-pattern ${patternSignal ? 'qms-ai-pattern-warn' : ''}`}>
          <TrendingDown size={14} />
          <span>{pattern.summary}</span>
        </div>
      )}

      {error && <ErrorBox>{error}</ErrorBox>}

      {generate.isPending && !suggestion ? (
        <p className="text-muted qms-ai-empty">Analysing this failure against similar past NCRs…</p>
      ) : !suggestion ? (
        <p className="text-muted qms-ai-empty">
          {isQE
            ? 'Generate a probable root cause and corrective actions, grounded in similar past resolved NCRs on this project.'
            : 'No AI suggestion yet.'}
        </p>
      ) : (
        <div className="qms-ai-body">
          <div className="qms-ai-meta">
            {conf && <Badge variant={conf.variant}>{conf.label}</Badge>}
            {suggestion.ndt_recommended && (
              <Badge variant="fail" icon={<ShieldAlert size={12} />}>NDT / core test recommended</Badge>
            )}
            <span className="text-muted qms-ai-grounding">
              {suggestion.retrieved.length > 0
                ? `Grounded in ${suggestion.retrieved.length} past NCR${suggestion.retrieved.length > 1 ? 's' : ''}`
                : 'No similar past NCRs — based on general practice'}
            </span>
          </div>

          {suggestion.root_cause_text && (
            <div>
              <div className="qms-ai-label">Probable root cause</div>
              <p className="qms-ai-text">{suggestion.root_cause_text}</p>
            </div>
          )}

          {suggestion.corrective_actions.length > 0 && (
            <div>
              <div className="qms-ai-label">Suggested corrective actions</div>
              <ul className="qms-ai-actions">
                {suggestion.corrective_actions.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </div>
          )}

          {suggestion.retrieved.length > 0 && (
            <div>
              <button
                type="button"
                className="qms-ai-sources-toggle"
                aria-expanded={showSources}
                onClick={() => setShowSources((v) => !v)}
              >
                {showSources ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                {showSources ? 'Hide' : 'Show'} the {suggestion.retrieved.length} similar past NCR{suggestion.retrieved.length > 1 ? 's' : ''} used
              </button>
              {showSources && (
                <div className="qms-ai-sources">
                  {suggestion.retrieved.map((r) => (
                    <div key={r.ncr_id} className="qms-ai-source">
                      <div className="qms-ai-source-head">
                        <span className="font-medium text-primary">{r.ncr_number ?? `NCR-${r.ncr_id}`}</span>
                        <span className="text-muted qms-ai-source-match">
                          {Math.round(r.similarity * 100)}% match{r.grade_name ? ` · ${r.grade_name}` : ''}
                        </span>
                      </div>
                      {r.root_cause && <div className="qms-ai-source-cause">{r.root_cause}</div>}
                      {r.corrective_actions.length > 0 && (
                        <div className="text-muted qms-ai-source-fix">
                          Fixed by: {r.corrective_actions.join('; ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {isQE && !isClosed && (suggestion.root_cause_text || suggestion.corrective_actions.length > 0) && (
            <div className="qms-ai-apply">
              <Button size="sm" variant="primary" disabled={busy} onClick={onApply}>
                Apply to this NCR
              </Button>
              <span className="text-muted qms-ai-apply-note">
                Copies the root cause and adds the actions — you can edit them after.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
