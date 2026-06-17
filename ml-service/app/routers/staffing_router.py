"""
Staffing Analysis Router
POST /api/staffing/analyze — Detects staffing bottlenecks and bus factor risks.
"""

import time
from fastapi import APIRouter
from loguru import logger

from app.schemas.common import APIResponse
from app.schemas.staffing_schemas import StaffingAnalysisInput, StaffingAnalysisResponse
from app.utils.staffing_analyzer import analyze_staffing_signals

router = APIRouter(prefix="/api/staffing", tags=["Staffing Analysis"])


@router.post("/analyze", response_model=APIResponse)
async def analyze_staffing(body: StaffingAnalysisInput):
    """
    Analyze sprint and team data for staffing bottlenecks.

    Detects:
    - Reviewer bottleneck (PR review lag + insufficient senior devs)
    - Backend/frontend workload imbalance
    - Bus factor risk (knowledge concentrated in one person)
    - Workload overload (too many PRs/tickets per developer)

    Returns actionable recommendations with estimated impact.
    """
    start_time = time.time()

    try:
        # Convert Pydantic models to dicts for internal processing
        sprint_dict = body.sprint_data.model_dump()
        history_dicts = [h.model_dump() for h in body.team_history]

        # Run staffing analysis
        result = analyze_staffing_signals(sprint_dict, history_dicts)

        # Build response
        response_data = StaffingAnalysisResponse(**result)

        elapsed = round(time.time() - start_time, 3)
        bottleneck_count = len(result.get("bottlenecks", []))
        logger.info(
            f"Staffing analysis: {bottleneck_count} bottleneck(s) detected, "
            f"bus_factor_risk={result.get('bus_factor_risk', False)} in {elapsed}s"
        )

        return APIResponse(success=True, data=response_data.model_dump())

    except Exception as e:
        elapsed = round(time.time() - start_time, 3)
        logger.error(f"Staffing analysis failed after {elapsed}s: {e}")
        return APIResponse(success=False, error=str(e))
