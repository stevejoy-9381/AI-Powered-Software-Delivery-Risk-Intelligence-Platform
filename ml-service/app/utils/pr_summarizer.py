"""
LLM PR Summarizer Module
Uses Groq API (free tier, llama-3.1-70b-versatile) to summarize pull requests
and flag risky changes.

Design decisions:
- Uses httpx (not OpenAI SDK) as specified — lighter dependency, more control
- In-memory cache keyed by PR content hash to avoid redundant API calls
- Heuristic fallback analysis when Groq fails or times out
- Groq endpoint: https://api.groq.com/openai/v1/chat/completions
"""

import os
import json
import hashlib
from typing import Optional

import httpx
from dotenv import load_dotenv
from loguru import logger

load_dotenv()

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.1-70b-versatile"

# In-memory cache for PR summaries keyed by content hash
_pr_cache: dict = {}


def _get_pr_content_hash(pr_data: dict) -> str:
    """Compute a SHA-256 content hash of the PR to use as a cache key."""
    title = pr_data.get("title", "")
    description = pr_data.get("description", "")
    files_changed = sorted(pr_data.get("files_changed", []))
    files_str = "".join(files_changed)
    
    content_str = f"{title}|{description}|{files_str}"
    return hashlib.sha256(content_str.encode("utf-8")).hexdigest()


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
    """Parse the LLM's JSON response, handling common formatting issues."""
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
    Caches results by PR content hash.
    """
    # ── Compute content hash cache key ─────────────────────
    content_hash = _get_pr_content_hash(pr_data)
    if content_hash in _pr_cache:
        logger.info("PR summary retrieved from content-hash cache")
        cached = _pr_cache[content_hash].copy()
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

        # ── Cache result ──
        _pr_cache[content_hash] = result.copy()
        logger.info("PR summary saved to content-hash cache")

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


async def detect_risk_patterns(pull_requests: list, sprint_goal: str = "") -> dict:
    """
    Detect cross-PR risk patterns in a sprint using Groq LLM or a heuristic fallback.
    """
    # ── Heuristic fallback computation first ────────────────
    auth_no_tests = 0
    payment_no_tests = 0
    large_changes = 0
    files_touched = {}

    for pr in pull_requests:
        title = pr.get("title", "").lower()
        summary = pr.get("summary", "").lower()
        risk_flags = [f.lower() for f in pr.get("risk_flags", [])]
        touches_auth = pr.get("touches_auth", False)
        touches_payments = pr.get("touches_payments", False)
        
        # Check files
        for f in pr.get("files_changed", []):
            files_touched[f] = files_touched.get(f, 0) + 1
            
        no_tests = "no tests" in risk_flags or "no-tests" in risk_flags or not pr.get("has_tests", True)
        
        if touches_auth and no_tests:
            auth_no_tests += 1
        if touches_payments and no_tests:
            payment_no_tests += 1
        if "large-diff" in risk_flags or "mega-diff" in risk_flags:
            large_changes += 1
            
    overlapping_files = [f for f, count in files_touched.items() if count > 1]
    
    heuristics = []
    if auth_no_tests > 0:
        heuristics.append(f"{auth_no_tests} PRs touched authentication logic without tests.")
    if payment_no_tests > 0:
        heuristics.append(f"{payment_no_tests} PRs modified payment gateways without tests.")
    if large_changes > 1:
        heuristics.append(f"{large_changes} large changesets detected in this sprint, increasing regression risk.")
    if len(overlapping_files) > 0:
        heuristics.append(f"{len(overlapping_files)} files modified concurrently across different PRs (e.g. {', '.join(overlapping_files[:3])}).")

    fallback_patterns = " ".join(heuristics) if heuristics else "No significant cross-PR risk patterns detected."
    fallback_risk = "high" if (auth_no_tests > 1 or payment_no_tests > 1 or len(overlapping_files) > 2) else ("medium" if heuristics else "low")
    
    # ── Get API key ──
    api_key = os.getenv("GROQ_API_KEY", "")
    if not api_key:
        logger.warning("GROQ_API_KEY not set — using fallback heuristic pattern analysis")
        return {
            "patterns_detected": fallback_patterns,
            "risk_level": fallback_risk,
            "has_critical_patterns": fallback_risk in ["high", "critical"]
        }

    # ── Build prompt for Groq ──
    prs_str = ""
    for i, pr in enumerate(pull_requests):
        prs_str += f"\nPR #{i+1}: {pr.get('title')}\n- Summary: {pr.get('summary')}\n- Risk Flags: {', '.join(pr.get('risk_flags', []))}\n- Touches Auth: {pr.get('touches_auth')}\n- Touches Payments: {pr.get('touches_payments')}\n- Files Changed: {', '.join(pr.get('files_changed', [])[:5])}\n"
        
    prompt = f"""You are a senior principal engineer analyzing pull request patterns for the current sprint.
Sprint Goal: {sprint_goal}

Analyze the following list of PR summaries and detect any cross-PR risk patterns (e.g. concurrent changes in the same codebase files, missing tests for critical paths like auth or billing, or excessive changes that deviate from the sprint goal).

List of PRs:
{prs_str}

Respond ONLY in JSON format:
{{
  "patterns_detected": "1-2 sentence summary of any detected risk patterns, or 'No significant cross-PR risk patterns detected.'",
  "risk_level": "low|medium|high|critical",
  "has_critical_patterns": true|false
}}"""

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                GROQ_API_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": GROQ_MODEL,
                    "messages": [
                        {"role": "system", "content": "You are a senior architect. Always respond in valid JSON only."},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.2,
                    "max_tokens": 256,
                }
            )
            
        if response.status_code != 200:
            logger.error(f"Groq API error on patterns: {response.status_code}")
            return {
                "patterns_detected": fallback_patterns,
                "risk_level": fallback_risk,
                "has_critical_patterns": fallback_risk in ["high", "critical"]
            }
            
        content = response.json().get("choices", [{}])[0].get("message", {}).get("content", "")
        parsed = _parse_llm_response(content)
        if parsed is None:
            logger.warning("Failed to parse pattern detection LLM response")
            return {
                "patterns_detected": fallback_patterns,
                "risk_level": fallback_risk,
                "has_critical_patterns": fallback_risk in ["high", "critical"]
            }
            
        return {
            "patterns_detected": parsed.get("patterns_detected", fallback_patterns),
            "risk_level": parsed.get("risk_level", fallback_risk),
            "has_critical_patterns": parsed.get("has_critical_patterns", False)
        }
    except Exception as e:
        logger.error(f"Pattern detection failed: {e}")
        return {
            "patterns_detected": fallback_patterns,
            "risk_level": fallback_risk,
            "has_critical_patterns": fallback_risk in ["high", "critical"]
        }


def clear_cache():
    """Clear the PR summary cache."""
    _pr_cache.clear()
    logger.info("PR summary cache cleared")
