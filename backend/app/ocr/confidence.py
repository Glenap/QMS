"""confidence.py — Step 7: Per-field and overall confidence scoring.

Every extraction result carries a confidence score ∈ [0.0, 1.0] computed from:
  1. Extraction method base score  (how reliable is the source?)
  2. Validation modifier            (penalty for invalid values)
  3. Cross-validation boost         (bonus when ≥2 independent sources agree)

Overall confidence is the weighted average of all field scores, with
IS-critical fields (test_date, grade, observed_strength_mpa) weighted 2×.
"""

from __future__ import annotations

# ── Base confidence per extraction method ────────────────────────────────────
# Higher = more reliable source.

METHOD_SCORES: dict[str, float] = {
    "pdfplumber_exact": 0.97,   # text directly from digital PDF layer
    "table_cell":       0.88,   # extracted from a structured table cell
    "regex_match":      0.90,   # regex pattern matched in digital text
    "llm_structured":   0.80,   # LLM returned structured JSON
    "llm_vision":       0.75,   # LLM vision extraction from image
    "tesseract_regex":  0.72,   # Tesseract OCR + regex pattern match
    "tesseract_raw":    0.65,   # Tesseract OCR, no regex confirmation
    "llm_freetext":     0.58,   # LLM extracted from unstructured text
    "not_found":        0.00,   # field absent from document
}

# Heavily-weighted fields for overall_confidence calculation
REQUIRED_FIELDS = {
    "test_date", "grade", "observed_strength_mpa",
    "required_strength_mpa", "challan_no", "vehicle_no",
}


def score_field(
    method: str,
    *,
    validation_passed: bool = True,
    cross_validated: bool = False,
) -> float:
    """Return a confidence score for a single extracted field.

    Args:
        method:           Extraction method key (see METHOD_SCORES).
        validation_passed: False if the value failed domain/type validation.
        cross_validated:   True if the value was confirmed by a second source.
    """
    base = METHOD_SCORES.get(method, 0.50)
    if not validation_passed:
        base *= 0.30    # Heavy penalty — value is probably wrong
    elif cross_validated:
        base = min(base + 0.05, 1.0)
    return round(base, 3)


def overall_confidence(fields: dict[str, dict]) -> float:
    """Weighted average confidence across all extracted fields.

    ``fields`` maps field_name → {"value": ..., "confidence": float, ...}.
    Required fields are weighted 2× to reflect their importance.
    """
    if not fields:
        return 0.0

    total_weight = 0.0
    weighted_sum = 0.0
    for name, result in fields.items():
        conf = float(result.get("confidence", 0.0))
        weight = 2.0 if name in REQUIRED_FIELDS else 1.0
        weighted_sum += weight * conf
        total_weight += weight

    return round(weighted_sum / total_weight, 3) if total_weight else 0.0


def confidence_label(score: float) -> str:
    """Human-readable label for a confidence score."""
    if score >= 0.85:
        return "HIGH"
    if score >= 0.60:
        return "MEDIUM"
    return "LOW"
