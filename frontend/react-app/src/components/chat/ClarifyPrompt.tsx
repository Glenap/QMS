// Renders the analyst agent's structured clarifying question as grouped,
// clickable filter chips (one choice per dimension). Applying builds a refined
// question — the original plus each selected option's phrase (which carries the
// concrete id / date range) — and re-asks. Shown when a broad question would
// otherwise scan a lot of data. See backend/app/ai/agent.py:build_clarification.

import React, { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import type { Clarification, ClarifyOption } from '../../api/chat';

interface Props {
  clarification: Clarification;
  baseQuestion: string;
  disabled?: boolean;
  onApply: (refined: string) => void;
}

export const ClarifyPrompt: React.FC<Props> = ({ clarification, baseQuestion, disabled, onApply }) => {
  const [sel, setSel] = useState<Record<string, ClarifyOption>>(() => {
    const init: Record<string, ClarifyOption> = {};
    for (const d of clarification.dimensions) init[d.key] = d.options[0];
    return init;
  });

  const apply = () => {
    const phrases = clarification.dimensions.map((d) => sel[d.key]?.value).filter(Boolean);
    const refined = phrases.length ? `${baseQuestion} — ${phrases.join(', ')}` : baseQuestion;
    onApply(refined);
  };

  return (
    <div className="qms-clarify">
      {clarification.dimensions.map((d) => (
        <div key={d.key} className="qms-clarify-dim">
          <div className="qms-clarify-label">{d.label}</div>
          <div className="qms-clarify-opts">
            {d.options.map((o) => (
              <button
                key={o.label}
                type="button"
                className={`qms-clarify-chip ${sel[d.key]?.label === o.label ? 'is-sel' : ''}`}
                onClick={() => setSel((s) => ({ ...s, [d.key]: o }))}
                disabled={disabled}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      ))}
      <button type="button" className="qms-clarify-apply" onClick={apply} disabled={disabled}>
        <SlidersHorizontal size={13} /> Apply filters
      </button>
    </div>
  );
};
