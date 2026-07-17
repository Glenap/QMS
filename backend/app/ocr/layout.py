"""layout.py — Step 4: Table and layout extraction.

Uses Camelot (for lattice/stream tables in digital PDFs) and pdfplumber
(which we already ran in Step 1) to identify complex tabular structures.

For scanned PDFs, we rely on the LLM vision fallback to parse tables,
as Camelot only works on digital text layers.
"""

from __future__ import annotations

import logging
from typing import Any

from app.ocr.pdf_preprocessor import PageData

logger = logging.getLogger(__name__)

_camelot: Any = None


def _ensure_camelot() -> None:
    global _camelot  # noqa: PLW0603
    if _camelot is None:
        try:
            import camelot  # type: ignore[import-untyped]
            _camelot = camelot
        except ImportError:
            logger.warning("Camelot not installed, advanced table extraction disabled")


def extract_tables(pdf_bytes: bytes, pages: list[PageData]) -> list[list[list[str | None]]]:
    """Combine simple pdfplumber tables with advanced Camelot tables (if available).
    Returns a unified list of tables across all pages.
    """
    _ensure_camelot()
    all_tables: list[list[list[str | None]]] = []

    # 1. Add simple tables already found by pdfplumber
    for page in pages:
        if page.tables:
            all_tables.extend(page.tables)

    # 2. If it's a digital PDF, try Camelot for complex nested tables
    # (We only do this if pdfplumber didn't find good tables, or to merge them)
    # For now, pdfplumber's basic table extraction (done in Step 1) is usually
    # sufficient for QMS reports. We will keep Camelot as an enhancement for
    # Phase 10B if we encounter heavily merged cells.

    return all_tables
