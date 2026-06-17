"""
PR Summarization Router
POST /api/pr/summarize — Uses LLM to summarize pull requests and flag risks.
"""

import time
from fastapi import APIRouter
from loguru import logger

from app.schemas.common import APIResponse
from app.schemas.pr_schemas import PRDataInput, PRSummaryResponse
from app.utils.pr_summarizer import summarize_pr

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
