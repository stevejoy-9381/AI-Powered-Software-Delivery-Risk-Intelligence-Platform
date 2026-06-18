"""
PR Summarization Router
POST /api/pr/summarize — Uses LLM to summarize pull requests and flag risks.
"""

import time
from fastapi import APIRouter
from loguru import logger

from app.schemas.common import APIResponse
from app.schemas.pr_schemas import (
    PRDataInput, 
    PRSummaryResponse,
    PRBatchInput,
    PRBatchResponse,
    PRRiskPatternInput,
    PRRiskPatternResponse
)
from app.utils.pr_summarizer import summarize_pr, detect_risk_patterns

router = APIRouter(prefix="/api/pr", tags=["PR Summarization"])


@router.post("/summarize", response_model=APIResponse)
async def summarize_pull_request(body: PRDataInput):
    """
    Summarize a pull request using LLM (Groq API / llama-3.1-70b).

    Returns a structured analysis including:
    - Plain English summary
    - Risk level and flags
    - Auth/payment code detection
    - Scope assessment
    - Key reviewer note

    Results are cached by githubPrNumber to avoid redundant API calls.
    """
    start_time = time.time()

    try:
        # Convert Pydantic model to dict
        pr_dict = body.model_dump()

        # Call LLM summarizer
        result = await summarize_pr(pr_dict)

        # Build response
        response_data = PRSummaryResponse(**result)

        elapsed = round(time.time() - start_time, 3)
        cached_str = " (cached)" if result.get("cached", False) else ""
        logger.info(
            f"PR summarized: '{body.title[:50]}' — "
            f"risk={result.get('risk_level', '?')}{cached_str} in {elapsed}s"
        )

        return APIResponse(success=True, data=response_data.model_dump())

    except Exception as e:
        elapsed = round(time.time() - start_time, 3)
        logger.error(f"PR summarization failed after {elapsed}s: {e}")
        return APIResponse(success=False, error=str(e))


@router.post("/summarize-batch", response_model=APIResponse)
async def summarize_prs_batch(body: PRBatchInput):
    """
    Summarize a batch of pull requests (up to 10).
    """
    start_time = time.time()
    try:
        summaries = []
        for pr_data in body.pull_requests:
            pr_dict = pr_data.model_dump()
            res = await summarize_pr(pr_dict)
            summaries.append(PRSummaryResponse(**res))
        
        elapsed = round(time.time() - start_time, 3)
        logger.info(f"Batch PR summarization of {len(body.pull_requests)} PRs completed in {elapsed}s")
        return APIResponse(success=True, data={"summaries": [s.model_dump() for s in summaries]})
    except Exception as e:
        elapsed = round(time.time() - start_time, 3)
        logger.error(f"Batch PR summarization failed after {elapsed}s: {e}")
        return APIResponse(success=False, error=str(e))


@router.post("/detect-risk-pattern", response_model=APIResponse)
async def detect_sprint_risk_patterns(body: PRRiskPatternInput):
    """
    Detect cross-PR risk patterns in a sprint using Groq LLM or heuristic fallback.
    """
    start_time = time.time()
    try:
        prs_list = [pr.model_dump() for pr in body.pull_requests]
        result = await detect_risk_patterns(prs_list, body.sprint_goal)
        response_data = PRRiskPatternResponse(**result)
        elapsed = round(time.time() - start_time, 3)
        logger.info(f"Sprint risk pattern detection completed in {elapsed}s")
        return APIResponse(success=True, data=response_data.model_dump())
    except Exception as e:
        elapsed = round(time.time() - start_time, 3)
        logger.error(f"Sprint risk pattern detection failed after {elapsed}s: {e}")
        return APIResponse(success=False, error=str(e))
