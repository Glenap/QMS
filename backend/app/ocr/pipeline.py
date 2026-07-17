"""pipeline.py — Master orchestrator for the OCR pipeline.

Ties together preprocessing, classification, extraction, validation, and domain mapping.
Returns an OcrPipelineResult that the service layer saves to the DB.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from typing import Any

from app.config import settings
from app.ocr.classifier import DocType, classify, classify_with_llm
from app.ocr.confidence import overall_confidence
from app.ocr.engine import get_engine_for_page, should_use_llm_vision_fallback, LlmVisionEngine
from app.ocr.field_extractor import extract_fields
from app.ocr.field_mapper import map_to_domain
from app.ocr.layout import extract_tables
from app.ocr.pdf_preprocessor import preprocess_pdf, PreprocessError

logger = logging.getLogger(__name__)


@dataclass
class OcrPipelineResult:
    doc_type: str
    page_count: int
    is_mostly_digital: bool
    fields: dict[str, dict[str, Any]]
    domain_data: dict[str, Any]
    tables: list[list[list[str | None]]]
    raw_text: str
    overall_confidence: float
    processing_ms: int
    error: str | None = None


async def run_ocr_pipeline(pdf_bytes: bytes, llm_client: Any = None) -> OcrPipelineResult:
    """Run the full OCR extraction pipeline on a PDF."""
    start_time = time.monotonic()
    
    try:
        # Step 1: Preprocess (pdfplumber + pdf2image)
        logger.info("OCR Step 1: Preprocessing PDF...")
        prep_result = preprocess_pdf(pdf_bytes, max_pages=settings.OCR_MAX_PAGES)
        
        # Step 2: Extract text per page
        logger.info("OCR Step 2: Extracting text across %d pages", prep_result.page_count)
        full_text_parts = []
        
        for page in prep_result.pages:
            engine = get_engine_for_page(page, llm_client)
            text, conf = engine.extract_text(page)
            
            # Check LLM Vision Fallback if it's a poor scan
            if not page.is_digital and should_use_llm_vision_fallback(conf):
                logger.info("Page %d: Tesseract confidence %.2f too low, falling back to LLM Vision", page.page_number, conf)
                if llm_client:
                    vision_engine = LlmVisionEngine(llm_client)
                    text, conf = vision_engine.extract_text(page)
            
            page.text = text
            full_text_parts.append(text)
            
        full_text = "\n\n".join(full_text_parts)
        
        # Step 3: Classify document type
        logger.info("OCR Step 3: Classifying document type")
        doc_type, score = classify(full_text)
        if doc_type == DocType.UNKNOWN and llm_client:
            logger.info("Keyword classification ambiguous (score %.1f), using LLM...", score)
            doc_type = await classify_with_llm(full_text, llm_client)
            
        logger.info("Classified as: %s", doc_type)
        
        # Step 4: Layout and Tables
        logger.info("OCR Step 4: Extracting tables")
        tables = extract_tables(pdf_bytes, prep_result.pages)
        
        # Step 5: Extract Fields
        if llm_client:
            logger.info("OCR Step 5: Extracting fields via LLM template")
            from app.ocr.field_extractor import extract_fields_with_llm
            fields = await extract_fields_with_llm(doc_type, full_text, llm_client, prep_result.pages, tables)
        else:
            logger.info("OCR Step 5: Extracting fields via regex template")
            fields = extract_fields(doc_type, full_text, prep_result.pages, tables)
        
        # Step 6: Validate (TODO: run validators per doc_type)
        # For now, validation is simple type casting done in extract_fields
        
        # Step 7: Domain Mapping
        logger.info("OCR Step 7: Mapping to domain schema")
        domain_data = map_to_domain(doc_type, fields)
        
        # Step 8: Confidence
        conf = overall_confidence(fields)
        logger.info("OCR completed with confidence %.2f", conf)
        
        processing_ms = int((time.monotonic() - start_time) * 1000)
        
        return OcrPipelineResult(
            doc_type=doc_type,
            page_count=prep_result.page_count,
            is_mostly_digital=prep_result.is_mostly_digital,
            fields=fields,
            domain_data=domain_data,
            tables=tables,
            raw_text=full_text,
            overall_confidence=conf,
            processing_ms=processing_ms,
        )
        
    except PreprocessError as e:
        logger.error("Preprocessing failed: %s", e)
        return _error_result(str(e), start_time)
    except Exception as e:
        logger.exception("OCR Pipeline failed with unhandled exception")
        return _error_result(str(e), start_time)


def _error_result(msg: str, start_time: float) -> OcrPipelineResult:
    return OcrPipelineResult(
        doc_type=DocType.UNKNOWN,
        page_count=0,
        is_mostly_digital=False,
        fields={},
        domain_data={},
        tables=[],
        raw_text="",
        overall_confidence=0.0,
        processing_ms=int((time.monotonic() - start_time) * 1000),
        error=msg,
    )
