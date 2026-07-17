"""correction_learner.py — Continuous improvement loop.

Records user corrections to OCR results and uses them to detect failing patterns.
If a field has a high correction rate, it signals that the YAML regex template
needs an update or the OCR engine confidence needs tuning.
"""

from __future__ import annotations

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.quality import OcrFieldCorrection

logger = logging.getLogger(__name__)


async def record_corrections(
    session: AsyncSession,
    job_id: str,
    doc_type: str,
    user_id: int,
    original_fields: dict,
    final_fields: dict,
) -> None:
    """Compare final_fields against original_fields and log any differences."""
    
    corrections = []
    
    for field_name, original_data in original_fields.items():
        if not isinstance(original_data, dict):
            continue
            
        original_val = str(original_data.get("value")) if original_data.get("value") is not None else ""
        final_val = str(final_fields.get(field_name)) if final_fields.get(field_name) is not None else ""
        
        if original_val != final_val:
            corrections.append(
                OcrFieldCorrection(
                    job_id=job_id,
                    doc_type=doc_type,
                    field_name=field_name,
                    extracted_value=original_val,
                    corrected_value=final_val,
                    corrected_by=user_id,
                )
            )
            
    if corrections:
        session.add_all(corrections)
        await session.flush()
        logger.info("Recorded %d OCR corrections for job %s", len(corrections), job_id)
