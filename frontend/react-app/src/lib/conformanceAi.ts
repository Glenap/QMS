// ── AI interpretation — PLACEHOLDER for the real photo-defect model ──────────
//
// DefectSpec fabricated an "AI interpretation" (a suggested defect + a confidence
// %) for every uploaded photo, which the inspector accepts or overrides. Strata
// has no vision model yet, so this is a DETERMINISTIC stub: the same photo always
// yields the same suggestion, drawn from the phase's taxonomy, so the whole
// accept/override + report workflow is fully usable today.
//
// >>> THIS IS THE ONLY PIECE THE REAL MODEL REPLACES. <<<
// When a vision model exists, swap `interpretPhoto` for a call that returns the
// model's { defectCode, confidence } for the image — everything downstream (the
// suggestion chip, Accept/Override, sorting by confidence, the report) already
// consumes that shape unchanged.

import { taxonomyFor, type DefectPhase } from '../data/defectTaxonomy';

export interface AiInterpretation {
  defectCode: string;
  confidence: number; // 0–100
  simulated: true; // flag so the UI can label it clearly as not-yet-real
}

// FNV-1a — stable hash so a given photo always gets the same suggestion.
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function interpretPhoto(key: string, phase: DefectPhase): AiInterpretation {
  const catalogue = taxonomyFor(phase);
  const h = hash(`${phase}:${key}`);
  const defect = catalogue[h % catalogue.length];
  return { defectCode: defect.code, confidence: 72 + (h % 27), simulated: true };
}
