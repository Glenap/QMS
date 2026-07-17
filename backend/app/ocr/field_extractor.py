"""field_extractor.py — Step 5: Data extraction via regex and templates.

Loads the YAML template for the document type and attempts to extract
each field using the provided regex patterns against the full document text.
Applies transformations (e.g. kN → MPa for load cells).
"""

from __future__ import annotations

import logging
import re
from typing import Any

import yaml

from app.ai.llm import LLMClient
from app.config import settings
from app.ocr.confidence import score_field
from app.ocr.pdf_preprocessor import PageData

logger = logging.getLogger(__name__)


def extract_fields(
    doc_type: str,
    text: str,
    pages: list[PageData],
    tables: list[list[list[str | None]]],
) -> dict[str, dict[str, Any]]:
    """Extract fields based on the YAML template for the doc_type."""
    import os
    
    template_path = os.path.join(
        os.path.dirname(__file__), "templates", f"{doc_type.lower()}.yaml"
    )
    if not os.path.exists(template_path):
        logger.warning("No template found for doc_type=%s", doc_type)
        return {}

    with open(template_path, encoding="utf-8") as f:
        template = yaml.safe_load(f)

    results: dict[str, dict[str, Any]] = {}
    
    # Check if mostly digital or scanned to determine the base confidence method
    method_prefix = "regex_match"
    if pages and sum(1 for p in pages if not p.is_digital) > len(pages) / 2:
        method_prefix = "tesseract_regex"
        
    for field_name, config in template.get("fields", {}).items():
        extracted = _extract_single_field(field_name, config, text)
        if extracted is not None:
            val, method_suffix = extracted
            method = method_prefix if method_suffix == "regex" else method_suffix
            
            results[field_name] = {
                "value": val,
                "confidence": score_field(method),
                "method": method,
            }
        else:
            results[field_name] = {
                "value": None,
                "confidence": 0.0,
                "method": "none",
            }

    # Optional: cross-check with tables if needed
    # ...

    return results


def _extract_single_field(field_name: str, config: dict, text: str) -> tuple[Any, str] | None:
    patterns = config.get("patterns", [])
    
    for pat in patterns:
        match = re.search(pat, text, re.IGNORECASE)
        if match:
            raw_val = match.group(1).strip()
            
            # Apply type casting
            try:
                t = config.get("type", "string")
                if t == "float":
                    val = float(raw_val)
                elif t == "int":
                    val = int(raw_val)
                else:
                    val = raw_val
                return val, "regex"
            except ValueError:
                continue

    # Special handling for kN loads -> MPa
    kn_patterns = config.get("load_kn_patterns", [])
    for pat in kn_patterns:
        match = re.search(pat, text, re.IGNORECASE)
        if match:
            raw_val = match.group(1).strip()
            try:
                # MPa = kN * 1000 / (150 * 150)
                val = float(raw_val) * 1000 / 22500
                return round(val, 2), "regex"
            except ValueError:
                continue
                
    return None


async def extract_fields_with_llm(
    doc_type: str,
    text: str,
    llm_client: LLMClient,
    pages: list[PageData],
    tables: list[list[list[str | None]]],
) -> dict[str, dict[str, Any]]:
    """Extract fields using an LLM based on the YAML template."""
    import os
    
    template_path = os.path.join(
        os.path.dirname(__file__), "templates", f"{doc_type.lower()}.yaml"
    )
    if not os.path.exists(template_path):
        logger.warning("No template found for doc_type=%s, falling back to regex", doc_type)
        return extract_fields(doc_type, text, pages, tables)

    with open(template_path, encoding="utf-8") as f:
        template = yaml.safe_load(f)

    fields_config = template.get("fields", {})
    if not fields_config:
        return {}

    # Build the JSON schema for the tool
    properties = {}
    for field_name, config in fields_config.items():
        t = config.get("type", "string")
        if t == "float":
            json_type = "number"
        elif t == "int":
            json_type = "integer"
        else:
            json_type = "string"
            
        prop = {
            "type": json_type,
            "description": config.get("label", field_name)
        }
        if "allowed_values" in config:
            prop["enum"] = config["allowed_values"]
            
        properties[field_name] = prop

    tool = {
        "type": "function",
        "function": {
            "name": "extract_document_fields",
            "description": f"Extract structured data from a {doc_type} document.",
            "parameters": {
                "type": "object",
                "properties": properties,
                "required": template.get("required_fields", [])
            }
        }
    }

    system_prompt = (
        "You are an expert data extraction AI. Your task is to extract highly accurate data from raw OCR text "
        "and populate the JSON schema. The text may contain OCR noise, typos, or messy formatting "
        "(e.g., 'kg/m' instead of 'kg/m3', missing spaces, duplicate symbols like '% 0.40 %'). "
        "Intelligently infer the correct value for each requested field. Pay close attention to the descriptions which indicate the required data."
    )

    messages = [
        {
            "role": "system",
            "content": system_prompt
        },
        {
            "role": "user", 
            "content": f"Extract all relevant fields from this document. If a value is genuinely missing, omit it.\n\nDOCUMENT:\n{text}"
        }
    ]

    try:
        reply = await llm_client.chat(messages, tools=[tool])
        
        extracted_args = {}
        for tc in reply.tool_calls:
            if tc.name == "extract_document_fields":
                extracted_args = tc.arguments
                break
                
    except Exception as e:
        logger.warning("LLM extraction failed: %s, falling back to regex", e)
        return extract_fields(doc_type, text, pages, tables)

    # Build standard results format
    results: dict[str, dict[str, Any]] = {}
    
    for field_name, config in fields_config.items():
        val = extracted_args.get(field_name)
        
        # If LLM didn't return it, try regex fallback for that single field
        if val is None:
            regex_extracted = _extract_single_field(field_name, config, text)
            if regex_extracted is not None:
                r_val, r_method = regex_extracted
                results[field_name] = {
                    "value": r_val,
                    "confidence": score_field(r_method),
                    "method": r_method,
                }
                continue

        if val is not None:
            results[field_name] = {
                "value": val,
                "confidence": 0.9, # High confidence for LLM extraction
                "method": "llm",
            }
        else:
            results[field_name] = {
                "value": None,
                "confidence": 0.0,
                "method": "none",
            }

    return results
