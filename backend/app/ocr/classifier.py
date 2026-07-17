"""classifier.py — Step 2: Document type classification.

Strategy (two-stage):
  1. Fast keyword scoring against per-type keyword sets.
     Returns the best type when score ≥ MIN_KEYWORD_SCORE.
  2. LLM fallback for ambiguous documents (score < threshold).
     Sends the first 1500 chars of the document to the LLM with a structured
     prompt and expects one of the known type tokens back.

The classifier is intentionally stateless and side-effect-free so it can be
called inline in unit tests without a live LLM.
"""

from __future__ import annotations

import logging
import re

logger = logging.getLogger(__name__)


# ── Document type constants ───────────────────────────────────────────────────

class DocType:
    CUBE_TEST_REPORT  = "CUBE_TEST_REPORT"
    LAB_REPORT        = "LAB_REPORT"
    DELIVERY_CHALLAN  = "DELIVERY_CHALLAN"
    MIX_DESIGN_CERT   = "MIX_DESIGN_CERT"
    INSPECTION_REPORT = "INSPECTION_REPORT"
    UNKNOWN           = "UNKNOWN"

    ALL = [
        CUBE_TEST_REPORT,
        LAB_REPORT,
        DELIVERY_CHALLAN,
        MIX_DESIGN_CERT,
        INSPECTION_REPORT,
    ]


# ── Keyword sets per document type ────────────────────────────────────────────
# Each entry is (keyword_regex, weight).  Weights allow high-confidence signals
# (like "IS 516" for cube tests) to score more than generic terms.

_KEYWORD_RULES: dict[str, list[tuple[str, float]]] = {
    DocType.CUBE_TEST_REPORT: [
        (r"cube\s+test",          3.0),
        (r"compressive\s+strength", 2.0),
        (r"IS[\s\-]?516",         3.0),
        (r"N/mm[²2]",             1.5),
        (r"test\s+age",           1.5),
        (r"load\s+at\s+failure",  2.5),
        (r"specimen",             1.0),
        (r"crushing\s+strength",  2.0),
        (r"mould\s+size",         1.5),
        (r"CTM",                  1.0),
    ],
    DocType.LAB_REPORT: [
        (r"NABL",                 3.0),
        (r"lab(?:oratory)?\s+report", 3.0),
        (r"accreditation",        2.0),
        (r"test\s+certificate",   2.0),
        (r"sample\s+receipt",     1.5),
        (r"IS[\s\-]?516",         1.5),  # also appears in cube, so lower weight
        (r"testing\s+lab",        2.0),
    ],
    DocType.DELIVERY_CHALLAN: [
        (r"delivery\s+challan",   4.0),
        (r"challan\s+no",         4.0),
        (r"vehicle\s+no",         2.0),
        (r"truck\s+no",           2.0),
        (r"transit\s+mix",        2.0),
        (r"dispatch(?:ed)?",      1.5),
        (r"plant\s+time",         2.0),
        (r"site\s+time",          2.0),
        (r"slump\s+test",         1.5),
        (r"RMC",                  1.5),
        (r"cum\b",                1.0),  # cubic metres unit
    ],
    DocType.MIX_DESIGN_CERT: [
        (r"mix\s+design",         4.0),
        (r"water[\s\-]?cement\s+ratio", 3.0),
        (r"w/c",                  2.0),
        (r"IS[\s\-]?10262",       3.0),
        (r"fly[\s\-]?ash",        1.5),
        (r"admixture",            1.5),
        (r"fine\s+aggregate",     1.5),
        (r"coarse\s+aggregate",   1.5),
        (r"target\s+mean\s+strength", 2.5),
        (r"trial\s+mix",          2.5),
        (r"cement\s+content",     2.0),
    ],
    DocType.INSPECTION_REPORT: [
        (r"inspection\s+report",  4.0),
        (r"site\s+inspection",    3.0),
        (r"checklist",            2.0),
        (r"non[\s\-]?conformance", 2.0),
        (r"snag",                 1.5),
        (r"punch\s+list",         2.0),
        (r"observations?",        1.0),
        (r"inspector",            2.0),
    ],
}

MIN_KEYWORD_SCORE = 4.0   # Minimum total score to classify without LLM
LLM_MIN_CONFIDENCE = 3.0  # Minimum score to even try keyword path before LLM


def classify(text: str) -> tuple[str, float]:
    """Classify a document from its raw text.

    Returns (doc_type, score) — score is the keyword score (0.0 for LLM-only).
    Call ``classify_with_llm`` when score < MIN_KEYWORD_SCORE.
    """
    lower = text.lower()
    scores: dict[str, float] = {}
    for doc_type, rules in _KEYWORD_RULES.items():
        total = sum(
            weight for pattern, weight in rules
            if re.search(pattern, lower, re.IGNORECASE)
        )
        scores[doc_type] = total

    best_type = max(scores, key=lambda k: scores[k])
    best_score = scores[best_type]

    if best_score >= MIN_KEYWORD_SCORE:
        logger.debug("Classifier: %s (score=%.1f)", best_type, best_score)
        return best_type, best_score

    logger.debug("Classifier: score too low (%.1f) — LLM fallback needed", best_score)
    return DocType.UNKNOWN, best_score


async def classify_with_llm(text: str, llm_client: object) -> str:  # type: ignore[type-arg]
    """LLM fallback classifier.  Only called when keyword scoring is ambiguous.

    Sends the first 1500 chars of the document text to the LLM and asks it to
    return exactly one of the known type tokens.  Falls back to UNKNOWN on any
    error.
    """
    snippet = text[:1500].strip()
    types_list = ", ".join(DocType.ALL)

    prompt = (
        "You are a document classifier for a construction quality management system.\n"
        f"Classify the following document into EXACTLY ONE of these types: {types_list}\n"
        "Return ONLY the type token, nothing else. If unsure, return UNKNOWN.\n\n"
        f"Document text:\n{snippet}"
    )

    try:
        reply = await llm_client.chat(  # type: ignore[attr-defined]
            messages=[{"role": "user", "content": prompt}],
            tools=[],
        )
        result = (reply.content or "").strip().upper()
        if result in DocType.ALL:
            logger.debug("LLM classifier → %s", result)
            return result
        # Try to find a valid type embedded in the response
        for dt in DocType.ALL:
            if dt in result:
                return dt
    except Exception:
        logger.exception("LLM classifier failed")

    return DocType.UNKNOWN
