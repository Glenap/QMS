// Code-standard selection for the Analytics page. The analytics engine is built
// on the Indian Standard (IS 456 acceptance criteria + IS 10262 mix-design
// statistics). ACI is offered as a selectable standard but is NOT implemented —
// selecting it hides the analytics (no values are shown), by design. The clause
// map records which clause each analytic is drawn from and which reference-PDF
// document category its "View PDF" link opens.

export type CodeStandard = 'IS' | 'ACI';

export const CODE_STANDARD_OPTIONS: { label: string; value: CodeStandard }[] = [
  { label: 'IS 456 / IS 10262 (Indian Standard)', value: 'IS' },
  { label: 'ACI 318 / ACI 214 (American Concrete Institute)', value: 'ACI' },
];

// Reference-PDF document categories (mirror backend DocumentCategory). These are
// project documents tagged so the analytics can link to the uploaded standard.
export const CODE_DOC_TYPE = {
  IS456: 'CODE_IS456',
  IS10262: 'CODE_IS10262',
  ACI: 'CODE_ACI',
} as const;

// The reference PDFs a user can attach (used by the "Code PDFs" manager).
export const CODE_PDF_SLOTS: { docType: string; label: string }[] = [
  { docType: CODE_DOC_TYPE.IS456, label: 'IS 456' },
  { docType: CODE_DOC_TYPE.IS10262, label: 'IS 10262' },
];

export interface ClauseRef {
  code: string; // e.g. "IS 456:2000"
  ref: string; // the clause / basis text
  docType: string; // which reference PDF the "View PDF" link opens
}

// Which clause / basis each analytic is drawn from (IS basis). No analytic
// values here — only the citation shown next to each chart.
export const CLAUSES: Record<string, ClauseRef> = {
  graphical: {
    code: 'IS 10262:2019',
    ref: 'Annex A — standard deviation & target mean strength',
    docType: CODE_DOC_TYPE.IS10262,
  },
  run: {
    code: 'IS 456:2000',
    ref: 'cl. 16 — acceptance criteria (individual ≥ fck−3/4, mean ≥ fck+0.825σ)',
    docType: CODE_DOC_TYPE.IS456,
  },
  distribution: {
    code: 'IS 10262:2019',
    ref: 'target mean strength = fck + 1.65σ',
    docType: CODE_DOC_TYPE.IS10262,
  },
  targetMean: {
    code: 'IS 10262:2019',
    ref: 'target mean strength = fck + 1.65σ (Table 2 assumed σ)',
    docType: CODE_DOC_TYPE.IS10262,
  },
  cusum: {
    code: 'IS 456:2000',
    ref: 'cl. 16 — running quality control of mean strength',
    docType: CODE_DOC_TYPE.IS456,
  },
  ttest: {
    code: 'IS 456:2000',
    ref: 'cl. 15–16 — statistical basis for acceptance',
    docType: CODE_DOC_TYPE.IS456,
  },
};
