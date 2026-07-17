"""field_mapper.py — Step 8: Domain mapping.

Maps extracted JSON fields into the specific Pydantic schemas needed by the
QMS frontend (e.g. `CubeSampleCreate`).
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


def map_to_domain(doc_type: str, fields: dict[str, dict[str, Any]]) -> dict[str, Any]:
    """Map generic extracted fields to domain-specific schemas."""
    
    if doc_type == "CUBE_TEST_REPORT":
        return {
            "test_date": fields.get("test_date", {}).get("value"),
            "grade": fields.get("grade", {}).get("value"),
            "observed_strength_mpa": fields.get("observed_strength_mpa", {}).get("value"),
            "test_age_days": fields.get("test_age_days", {}).get("value"),
            "sample_ref": fields.get("sample_ref", {}).get("value"),
        }
    
    if doc_type == "DELIVERY_CHALLAN":
        return {
            "challan_no": fields.get("challan_no", {}).get("value"),
            "vehicle_no": fields.get("vehicle_no", {}).get("value"),
            "dispatch_time": fields.get("dispatch_time", {}).get("value"),
            "grade": fields.get("grade", {}).get("value"),
            "ordered_volume": fields.get("volume", {}).get("value"),
        }

    if doc_type == "MIX_DESIGN_CERT":
        return {k: v.get("value") for k, v in fields.items()}

    return {k: v.get("value") for k, v in fields.items()}
