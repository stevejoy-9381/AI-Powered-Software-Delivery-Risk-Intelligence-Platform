"""
Hotspot Analysis Router
POST /api/hotspots/analyze — Detects fragile codebase files at high risk of causing bugs.
"""

import time
from fastapi import APIRouter
from loguru import logger

from app.schemas.common import APIResponse
from app.schemas.hotspot_schemas import HotspotAnalysisRequest, HotspotAnalysisResponse
from app.utils.hotspot_analyzer import rank_hotspots

router = APIRouter(prefix="/api/hotspots", tags=["Hotspot Analysis"])


@router.post("/analyze", response_model=APIResponse)
async def analyze_hotspots(body: HotspotAnalysisRequest):
    """
    Analyze codebase files for hotspot risk.

    Accepts a list of file metadata and returns a ranked list of hotspots
    with scores, flags, and explanations for each file.

    Hotspot scoring formula:
    - Churn (40 pts max): Frequently modified files
    - Test penalty (30 pts max): Missing or low coverage
    - Authors (15 pts max): Too many contributors
    - Critical path (15 pts): Auth/payment/core files
    """
    start_time = time.time()

    try:
        # Convert Pydantic models to dicts
        files_data = [f.model_dump() for f in body.files]

        # Run hotspot analysis
        results = rank_hotspots(files_data)

        # Build response
        hotspot_count = sum(1 for r in results if r.get("is_hotspot", False))

        response_data = HotspotAnalysisResponse(
            total_files_analyzed=len(results),
            hotspot_count=hotspot_count,
            hotspots=results,
        )

        elapsed = round(time.time() - start_time, 3)
        logger.info(
            f"Hotspot analysis: {len(results)} files analyzed, "
            f"{hotspot_count} hotspots found in {elapsed}s"
        )

        return APIResponse(success=True, data=response_data.model_dump())

    except Exception as e:
        elapsed = round(time.time() - start_time, 3)
        logger.error(f"Hotspot analysis failed after {elapsed}s: {e}")
        return APIResponse(success=False, error=str(e))
