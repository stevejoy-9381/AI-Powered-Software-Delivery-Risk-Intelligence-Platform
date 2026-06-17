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
