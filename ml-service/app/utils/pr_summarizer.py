"""
LLM PR Summarizer Module
Uses Groq API (free tier, llama-3.1-70b-versatile) to summarize pull requests
and flag risky changes.

Design decisions:
- Uses httpx (not OpenAI SDK) as specified — lighter dependency, more control
- In-memory LRU cache keyed by githubPrNumber to avoid redundant API calls
- Structured JSON prompt with fallback parsing on LLM response errors
- Groq endpoint: https://api.groq.com/openai/v1/chat/completions
"""

import os
import json
from functools import lru_cache
from typing import Optional

import httpx
from dotenv import load_dotenv
from loguru import logger

load_dotenv()

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.1-70b-versatile"

# In-memory cache for PR summaries keyed by PR number
_pr_cache: dict = {}


def _build_prompt(pr_data: dict) -> str:
    """Build the structured prompt for the LLM."""
    title = pr_data.get("title", "Untitled PR")
    description = pr_data.get("description", "No description provided")
    files_changed = pr_data.get("files_changed", [])
    additions = pr_data.get("additions", 0)
    deletions = pr_data.get("deletions", 0)
    has_tests = pr_data.get("has_tests", False)

    files_str = ", ".join(files_changed[:20]) if files_changed else "Not specified"

    return f"""You are a senior code reviewer. Analyze this pull request and respond ONLY in JSON format.

PR Title: {title}
PR Description: {description}
Files Changed: {files_str}
Lines Added: {additions} | Lines Deleted: {deletions}
Has Tests: {has_tests}

Respond with this exact JSON structure:
{{
  "summary": "2-3 sentence plain English summary of what this PR does",
  "risk_level": "low|medium|high",
  "risk_flags": ["list of specific concerns if any"],
  "touches_auth": true or false,
  "touches_payments": true or false,
  "scope_assessment": "on-scope|minor-scope-creep|major-scope-creep",
  "reviewer_note": "one key thing the reviewer should focus on"
}}"""


def _get_fallback_response(pr_data: dict) -> dict:
    """
    Return a safe fallback when LLM call or parsing fails.
    Uses basic heuristics to provide a reasonable response.
    """
    files_changed = pr_data.get("files_changed", [])
    additions = pr_data.get("additions", 0)
    deletions = pr_data.get("deletions", 0)
    has_tests = pr_data.get("has_tests", False)

    # Basic risk assessment from file paths
    files_lower = [f.lower() for f in files_changed]
    touches_auth = any(
        kw in f for f in files_lower
        for kw in ["auth", "login", "password", "token", "credential", "session"]
    )
    touches_payments = any(
        kw in f for f in files_lower
        for kw in ["payment", "billing", "stripe", "checkout", "invoice"]
    )

    risk_flags = []
    if not has_tests:
        risk_flags.append("No tests included")
    if additions + deletions > 500:
        risk_flags.append("Large changeset — harder to review")
    if touches_auth:
        risk_flags.append("Touches authentication code")
    if touches_payments:
        risk_flags.append("Touches payment code")

    risk_level = "high" if (touches_auth or touches_payments) else (
        "medium" if len(risk_flags) >= 2 else "low"
    )

    return {
        "summary": f"PR modifies {len(files_changed)} files with {additions} additions and {deletions} deletions.",
        "risk_level": risk_level,
        "risk_flags": risk_flags,
        "touches_auth": touches_auth,
        "touches_payments": touches_payments,
        "scope_assessment": "on-scope",
        "reviewer_note": "LLM analysis unavailable — manual review recommended.",
    }


def _parse_llm_response(content: str) -> Optional[dict]:
    """
    Parse the LLM's JSON response, handling common formatting issues.
    """
    if not content:
        return None

    # Try direct parse
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        pass

    # Try extracting JSON from markdown code blocks
    try:
        if "```json" in content:
            json_str = content.split("```json")[1].split("```")[0].strip()
            return json.loads(json_str)
        elif "```" in content:
            json_str = content.split("```")[1].split("```")[0].strip()
            return json.loads(json_str)
    except (json.JSONDecodeError, IndexError):
        pass

    # Try finding JSON object in the response
    try:
        start = content.index("{")
        end = content.rindex("}") + 1
        return json.loads(content[start:end])
    except (ValueError, json.JSONDecodeError):
        pass

    return None


async def summarize_pr(pr_data: dict) -> dict:
    """
    Summarize a pull request using Groq API (llama-3.1-70b-versatile).

    Args:
        pr_data: Dictionary with PR fields:
            - title (str)
            - description (str)
            - files_changed (list of file paths)
            - additions (int)
            - deletions (int)
            - has_tests (bool)
            - githubPrNumber (int, optional — used for caching)

    Returns:
        {
            "summary": str,
            "risk_level": "low"|"medium"|"high",
            "risk_flags": list[str],
            "touches_auth": bool,
            "touches_payments": bool,
            "scope_assessment": str,
            "reviewer_note": str,
            "cached": bool
        }
    """
    # ── Check cache ────────────────────────────────────────
    pr_number = pr_data.get("githubPrNumber")
    if pr_number and pr_number in _pr_cache:
        logger.info(f"PR #{pr_number} — returning cached summary")
        cached = _pr_cache[pr_number].copy()
        cached["cached"] = True
        return cached

    # ── Get API key ────────────────────────────────────────
    api_key = os.getenv("GROQ_API_KEY", "")
    if not api_key:
        logger.warning("GROQ_API_KEY not set — using fallback heuristic analysis")
        result = _get_fallback_response(pr_data)
        result["cached"] = False
        return result

    # ── Call Groq API ──────────────────────────────────────
    prompt = _build_prompt(pr_data)

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                GROQ_API_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": GROQ_MODEL,
                    "messages": [
                        {
                            "role": "system",
                            "content": "You are a senior code reviewer. Always respond in valid JSON only.",
                        },
                        {
                            "role": "user",
                            "content": prompt,
                        },
                    ],
                    "temperature": 0.3,
                    "max_tokens": 512,
                },
            )

        if response.status_code != 200:
            logger.error(
                f"Groq API error: {response.status_code} — {response.text[:200]}"
            )
            result = _get_fallback_response(pr_data)
            result["cached"] = False
            return result

        # ── Parse response ─────────────────────────────────
        response_data = response.json()
        content = (
            response_data.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
        )

        parsed = _parse_llm_response(content)

        if parsed is None:
            logger.warning("Failed to parse LLM response — using fallback")
            result = _get_fallback_response(pr_data)
            result["cached"] = False
            return result

        # Ensure all expected keys exist
        result = {
            "summary": parsed.get("summary", "Summary not available"),
            "risk_level": parsed.get("risk_level", "medium"),
            "risk_flags": parsed.get("risk_flags", []),
            "touches_auth": parsed.get("touches_auth", False),
            "touches_payments": parsed.get("touches_payments", False),
            "scope_assessment": parsed.get("scope_assessment", "on-scope"),
            "reviewer_note": parsed.get("reviewer_note", "No specific notes"),
            "cached": False,
        }

        # ── Cache result ───────────────────────────────────
        if pr_number:
            _pr_cache[pr_number] = result.copy()
            logger.info(f"PR #{pr_number} summary cached")

        return result

    except httpx.TimeoutException:
        logger.error("Groq API timed out")
        result = _get_fallback_response(pr_data)
        result["cached"] = False
        return result
    except Exception as e:
        logger.error(f"PR summarization failed: {e}")
        result = _get_fallback_response(pr_data)
        result["cached"] = False
        return result


def clear_cache():
    """Clear the PR summary cache."""
    _pr_cache.clear()
    logger.info("PR summary cache cleared")
