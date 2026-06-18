"""
PR Summarization Schemas
Pydantic models for the /api/pr/summarize endpoint.
"""

from typing import List, Optional
from pydantic import BaseModel, Field


# ── Input Models ──────────────────────────────────────────

class PRDataInput(BaseModel):
    """Pull request data for LLM summarization."""
    title: str
    description: str = ""
    files_changed: List[str] = Field(default_factory=list)
    additions: int = Field(default=0, ge=0)
    deletions: int = Field(default=0, ge=0)
    has_tests: bool = False
    githubPrNumber: Optional[int] = Field(
        default=None,
        description="GitHub PR number — used for caching summaries"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "title": "feat: add OAuth2 login with Google provider",
                "description": "Implements OAuth2 login flow with Google as the identity provider. Adds session management and token refresh.",
                "files_changed": [
                    "src/auth/oauth2.py",
                    "src/auth/session.py",
                    "src/routes/login.py",
                    "tests/test_auth.py",
                ],
                "additions": 340,
                "deletions": 45,
                "has_tests": True,
                "githubPrNumber": 127,
            }
        }


# ── Output Models ─────────────────────────────────────────

class PRSummaryResponse(BaseModel):
    """LLM-generated PR summary with risk flags."""
    summary: str
    risk_level: str  # "low", "medium", "high"
    risk_flags: List[str] = Field(default_factory=list)
    touches_auth: bool = False
    touches_payments: bool = False
    scope_assessment: str = "on-scope"  # "on-scope", "minor-scope-creep", "major-scope-creep"
    reviewer_note: str = ""
    cached: bool = False


# ── Batch and Risk Pattern Models ─────────────────────────

class PRBatchInput(BaseModel):
    """Input for batch PR summarization."""
    pull_requests: List[PRDataInput] = Field(..., max_length=100)


class PRBatchResponse(BaseModel):
    """Output for batch PR summarization."""
    summaries: List[PRSummaryResponse]


class PRSummaryDetail(BaseModel):
    """PR summary metadata for cross-PR analysis."""
    githubPrNumber: Optional[int] = None
    title: str
    summary: str
    risk_flags: List[str] = Field(default_factory=list)
    touches_auth: bool = False
    touches_payments: bool = False
    files_changed: List[str] = Field(default_factory=list)


class PRRiskPatternInput(BaseModel):
    """Input for sprint-level PR risk pattern detection."""
    pull_requests: List[PRSummaryDetail]
    sprint_goal: Optional[str] = ""


class PRRiskPatternResponse(BaseModel):
    """Output for sprint-level PR risk pattern detection."""
    patterns_detected: str
    risk_level: str  # "low" | "medium" | "high" | "critical"
    has_critical_patterns: bool

