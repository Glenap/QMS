"""pdf_preprocessor.py — Step 1 of the OCR pipeline.

Responsibilities:
  • Open the PDF with pdfplumber to extract the text layer.
  • Decide per-page whether the PDF is "digital" (has a real text layer) or
    "scanned" (image-only).  A page is digital when it yields ≥ 20 characters.
  • For scanned pages: rasterise with pdf2image and enhance the image with
    OpenCV (deskew, denoise, adaptive threshold) so Tesseract gets a clean input.
  • Return a list of PageData objects — one per page — which the engine and
    field-extraction steps consume.

System deps required:
  • poppler  — pdf2image needs `pdftoppm` (apt: poppler-utils, brew: poppler,
    Windows: https://github.com/oschwartz10612/poppler-windows/releases)
  • The PDF bytes are never written to a temp file; everything stays in memory
    for security (no path traversal risk).
"""

from __future__ import annotations

import io
import logging
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)

# Lazy imports — these are only needed at runtime; tests can mock them.
_pdfplumber: Any = None
_pdf2image: Any = None
_cv2: Any = None
_np: Any = None


def _ensure_imports() -> None:
    global _pdfplumber, _pdf2image, _cv2, _np  # noqa: PLW0603
    if _pdfplumber is None:
        import pdfplumber as _pp
        import numpy as np  # type: ignore[import-untyped]
        import cv2  # type: ignore[import-untyped]
        import pdf2image as _p2i
        _pdfplumber = _pp
        _pdf2image = _p2i
        _cv2 = cv2
        _np = np


@dataclass
class PageData:
    page_number: int          # 1-indexed
    is_digital: bool          # True = text layer present; False = scanned image
    text: str                 # extracted text (pdfplumber for digital, Tesseract for scanned)
    image_bytes: bytes | None = None  # PNG bytes of the enhanced page image (scanned only)
    tables: list[list[list[str | None]]] = field(default_factory=list)  # pdfplumber tables
    word_boxes: list[dict] = field(default_factory=list)  # pdfplumber word bounding boxes


@dataclass
class PreprocessResult:
    page_count: int
    pages: list[PageData]
    is_mostly_digital: bool  # True when >50% of pages are digital


# ── Public API ───────────────────────────────────────────────────────────────

def preprocess_pdf(pdf_bytes: bytes, max_pages: int = 20) -> PreprocessResult:
    """Extract text + images from a PDF in memory.

    Returns a PreprocessResult with one PageData per processed page
    (capped at max_pages to bound memory and latency).
    """
    _ensure_imports()
    try:
        return _preprocess(pdf_bytes, max_pages)
    except Exception as exc:
        logger.exception("PDF preprocessing failed")
        raise PreprocessError(str(exc)) from exc


# ── Internal ─────────────────────────────────────────────────────────────────

_DIGITAL_MIN_CHARS = 20  # characters per page to count as "digital"
_DPI = 200               # rasterisation resolution — good Tesseract/quality trade-off


def _preprocess(pdf_bytes: bytes, max_pages: int) -> PreprocessResult:
    pages: list[PageData] = []
    digital_count = 0

    with _pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        total_pages = len(pdf.pages)
        process_count = min(total_pages, max_pages)

        # Pre-render images for all pages at once (cheaper than per-page calls)
        # We only need images for scanned pages, so we defer and render lazily.
        raster_cache: dict[int, bytes] = {}

        for page_num in range(process_count):
            page = pdf.pages[page_num]
            page_text = (page.extract_text() or "").strip()
            is_digital = len(page_text) >= _DIGITAL_MIN_CHARS

            # Extract pdfplumber tables (works even for scanned if table lines exist)
            try:
                tables = page.extract_tables() or []
                cleaned_tables: list[list[list[str | None]]] = [
                    [[cell if cell else None for cell in row] for row in t if t]
                    for t in tables
                ]
            except Exception:
                cleaned_tables = []

            # Extract word bounding boxes for digital pages
            try:
                word_boxes = page.extract_words() if is_digital else []
            except Exception:
                word_boxes = []

            image_bytes: bytes | None = None
            if not is_digital:
                # Rasterise this page and enhance
                image_bytes = _rasterise_page(pdf_bytes, page_num)

            if is_digital:
                digital_count += 1

            pages.append(PageData(
                page_number=page_num + 1,
                is_digital=is_digital,
                text=page_text,
                image_bytes=image_bytes,
                tables=cleaned_tables,
                word_boxes=word_boxes,
            ))

    return PreprocessResult(
        page_count=total_pages,
        pages=pages,
        is_mostly_digital=digital_count > len(pages) / 2,
    )


def _rasterise_page(pdf_bytes: bytes, page_index: int) -> bytes:
    """Rasterise a single PDF page to an enhanced PNG (in memory)."""
    images = _pdf2image.convert_from_bytes(
        pdf_bytes,
        dpi=_DPI,
        first_page=page_index + 1,
        last_page=page_index + 1,
        fmt="png",
    )
    if not images:
        return b""
    pil_image = images[0]
    # Enhance: grayscale → denoise → adaptive threshold
    img_array = _np.array(pil_image)
    enhanced = _enhance_image(img_array)
    buf = io.BytesIO()
    import PIL.Image  # type: ignore[import-untyped]
    PIL.Image.fromarray(enhanced).save(buf, format="PNG")
    return buf.getvalue()


def _enhance_image(img: Any) -> Any:
    """Grayscale + denoise + adaptive-threshold for cleaner Tesseract input."""
    if img.ndim == 3:
        gray = _cv2.cvtColor(img, _cv2.COLOR_RGB2GRAY)
    else:
        gray = img
    denoised = _cv2.fastNlMeansDenoising(gray, h=10)
    # Deskew
    deskewed = _deskew(denoised)
    # Adaptive threshold binarisation
    binary = _cv2.adaptiveThreshold(
        deskewed, 255,
        _cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        _cv2.THRESH_BINARY,
        blockSize=11, C=2,
    )
    return binary


def _deskew(gray: Any) -> Any:
    """Straighten a slightly rotated scan using Hough-line analysis."""
    try:
        coords = _np.column_stack(_np.where(gray > 0))
        if len(coords) < 100:
            return gray
        angle = _cv2.minAreaRect(coords.astype(_np.float32))[-1]
        if angle < -45:
            angle = -(90 + angle)
        else:
            angle = -angle
        if abs(angle) < 0.5:
            return gray
        (h, w) = gray.shape[:2]
        center = (w // 2, h // 2)
        M = _cv2.getRotationMatrix2D(center, angle, 1.0)
        return _cv2.warpAffine(gray, M, (w, h),
                               flags=_cv2.INTER_CUBIC,
                               borderMode=_cv2.BORDER_REPLICATE)
    except Exception:
        return gray


class PreprocessError(RuntimeError):
    """Raised when the PDF cannot be read (corrupted, password-protected, etc.)."""
