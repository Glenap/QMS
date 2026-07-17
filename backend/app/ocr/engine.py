"""engine.py — Step 3: OCR engine abstraction.

Protocol:
    class OcrEngine(Protocol):
        def extract_text(self, page: PageData) -> str: ...

Implementations:
    PdfplumberEngine   — uses the existing text layer; zero external deps.
    TesseractEngine    — runs pytesseract on the rasterised page image.
    LlmVisionEngine    — sends the image to Gemini/GPT-4V as a fallback for
                         poor scans where Tesseract confidence is low.

The active engine is selected per-page based on page.is_digital and the
OCR_ENGINE config setting.  This keeps the pipeline adaptive: digital pages
always use pdfplumber (near-perfect accuracy, instant), scanned pages fall to
Tesseract, and hard-to-read scans fall to LLM Vision.
"""

from __future__ import annotations

import base64
import io
import logging
from typing import Any, Protocol, runtime_checkable

from app.config import settings
from app.ocr.pdf_preprocessor import PageData

logger = logging.getLogger(__name__)


@runtime_checkable
class OcrEngine(Protocol):
    def extract_text(self, page: PageData) -> tuple[str, float]:
        """Return (text, confidence).  confidence ∈ [0.0, 1.0]."""
        ...


# ── pdfplumber engine ─────────────────────────────────────────────────────────

class PdfplumberEngine:
    """Uses the text layer already extracted by the preprocessor.
    Confidence is always 0.97 for digital pages (virtually perfect).
    """

    def extract_text(self, page: PageData) -> tuple[str, float]:
        return page.text, 0.97


# ── Tesseract engine ──────────────────────────────────────────────────────────

class TesseractEngine:
    """Runs pytesseract on the rasterised page image."""

    def __init__(self) -> None:
        import pytesseract  # type: ignore[import-untyped]
        self._tess = pytesseract
        if settings.TESSERACT_CMD:
            self._tess.pytesseract.tesseract_cmd = settings.TESSERACT_CMD

    def extract_text(self, page: PageData) -> tuple[str, float]:
        if not page.image_bytes:
            return page.text, 0.50

        import PIL.Image  # type: ignore[import-untyped]
        pil_image = PIL.Image.open(io.BytesIO(page.image_bytes))

        # Run Tesseract with detailed confidence output
        try:
            data = self._tess.image_to_data(
                pil_image,
                output_type=self._tess.Output.DICT,
                config="--oem 3 --psm 3",
            )
            text = self._tess.image_to_string(pil_image, config="--oem 3 --psm 3")

            # Compute mean confidence of words with confidence ≥ 0
            confs = [int(c) for c in data.get("conf", []) if int(c) >= 0]
            mean_conf = (sum(confs) / len(confs) / 100.0) if confs else 0.60
            logger.debug("Tesseract page %d: mean_conf=%.2f", page.page_number, mean_conf)
            return text.strip(), round(mean_conf, 3)
        except Exception:
            logger.exception("Tesseract failed on page %d", page.page_number)
            return "", 0.0


# ── LLM Vision engine ─────────────────────────────────────────────────────────

class LlmVisionEngine:
    """Sends the page image to the LLM (Gemini Flash / GPT-4V) for OCR.

    Used only as a fallback when Tesseract confidence < threshold.
    Requires AI_PROVIDER=openai and the model to support vision inputs.
    """

    def __init__(self, llm_client: Any) -> None:
        self._llm = llm_client

    def extract_text(self, page: PageData) -> tuple[str, float]:
        import asyncio
        try:
            return asyncio.get_event_loop().run_until_complete(
                self._async_extract(page)
            )
        except Exception:
            logger.exception("LLM Vision failed on page %d", page.page_number)
            return "", 0.0

    async def _async_extract(self, page: PageData) -> tuple[str, float]:
        if not page.image_bytes:
            return "", 0.0
        b64 = base64.b64encode(page.image_bytes).decode()
        # OpenAI-compatible vision message format (Gemini supports this too)
        messages = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            "Extract ALL text from this construction document image. "
                            "Preserve layout, numbers, dates, and table structure. "
                            "Return ONLY the extracted text, nothing else."
                        ),
                    },
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/png;base64,{b64}"},
                    },
                ],
            }
        ]
        reply = await self._llm.chat(messages=messages, tools=[])
        text = (reply.content or "").strip()
        # LLM Vision confidence: fixed at 0.78 (good but not perfect)
        return text, 0.78


# ── Engine selector ───────────────────────────────────────────────────────────

def get_engine_for_page(page: PageData, llm_client: Any = None) -> OcrEngine:
    """Return the best engine for this page.

    Decision tree:
      digital page             → PdfplumberEngine (always)
      scanned + engine=pdfplumber  → PdfplumberEngine (limited text)
      scanned + engine=tesseract   → TesseractEngine
      scanned + engine=azure_di    → TesseractEngine (Azure DI handled at pipeline level)
    """
    if page.is_digital:
        return PdfplumberEngine()

    engine_setting = settings.OCR_ENGINE
    if engine_setting == "pdfplumber":
        return PdfplumberEngine()

    return TesseractEngine()


def should_use_llm_vision_fallback(confidence: float) -> bool:
    """True when Tesseract confidence is too low and LLM Vision is enabled."""
    return (
        settings.OCR_LLM_VISION_FALLBACK
        and settings.AI_PROVIDER == "openai"
        and confidence < settings.OCR_TESSERACT_CONF_THRESHOLD / 100.0
    )
