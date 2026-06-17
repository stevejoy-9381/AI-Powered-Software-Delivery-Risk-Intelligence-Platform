"""
Risk Assessment Schemas
Pydantic models for the /api/risk/score endpoint.
"""

from typing import List, Optional
from pydantic import BaseModel, Field


# ── Input Models ──────────────────────────────────────────

class TicketInput(BaseModel):
    """A single ticket/issue in the sprint."""
    id: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None  # "open", "in_progress", "in_review", "blocked", "done"
    addedMidSprint: bool = False
    reopenedCount: int = 0


class CommitInput(BaseModel):
    """A single commit in the sprint."""
    message: Optional[str] = None
    author: Optional[str] = None
    additions: int = 0
    deletions: int = 0
    files: List[str] = Field(default_factory=list)


class PullRequestInput(BaseModel):
    """A single pull request in the sprint."""
    title: Optional[str] = None
    status: Optional[str] = None  # "open", "merged", "closed"
    reviewLagHours: Optional[float] = None
    additions: int = 0
    deletions: int = 0


class SprintDataInput(BaseModel):
    """
    Complete sprint data for risk assessment.
    Sent from the Node.js backend after fetching from MongoDB.
    """
    # Core sprint info
    sprintId: Optional[str] = None
    sprintName: Optional[str] = None
    sprintGoal: Optional[str] = None
    sprintDays: int = 14
    daysRemaining: int = 7
    teamSize: int = Field(default=5, ge=1)

    # Points
    plannedPoints: int = 0
    completedPoints: int = 0

    # Work items
    tickets: List[TicketInput] = Field(default_factory=list)
    commits: List[CommitInput] = Field(default_factory=list)
    pullRequests: List[PullRequestInput] = Field(default_factory=list)

    # Historical context (optional — improves prediction accuracy)
    teamAvgCommitFrequency: Optional[float] = None
    teamAvgPrReviewLag: Optional[float] = None
    previousVelocities: List[float] = Field(default_factory=list)

    # Ground truth (for training only)
    wasDelayed: Optional[bool] = None

    class Config:
        json_schema_extra = {
            "example": {
                "sprintId": "sprint-42",
                "sprintName": "Sprint 42 - User Auth",
                "sprintGoal": "Implement OAuth2 login flow",
                "sprintDays": 14,
                "daysRemaining": 5,
                "teamSize": 6,
                "plannedPoints": 34,
                "completedPoints": 18,
                "tickets": [
                    {"title": "Implement OAuth2 flow", "status": "in_progress", "addedMidSprint": False},
                    {"title": "Fix login page CSS", "status": "blocked", "reopenedCount": 1},
                ],
                "commits": [
                    {"message": "feat: add OAuth2 provider", "author": "alice", "additions": 200, "deletions": 10},
                    {"message": "hotfix: revert broken auth", "author": "bob", "additions": 5, "deletions": 50},
                ],
                "pullRequests": [
                    {"title": "OAuth2 implementation", "status": "open", "reviewLagHours": 48},
                ],
                "teamAvgCommitFrequency": 8.5,
                "teamAvgPrReviewLag": 12.0,
                "previousVelocities": [0.85, 0.92, 0.78],
            }
        }


# ── Output Models ─────────────────────────────────────────

class RiskFactor(BaseModel):
    """A single risk factor explanation."""
    factor: str
    severity: str  # "low", "medium", "high", "critical"
    description: str


class RiskScoreResponse(BaseModel):
    """Complete risk assessment result."""
    model_config = {"protected_namespaces": ()}

    risk_score: float = Field(..., ge=0, le=100)
    risk_level: str  # "low", "medium", "high", "critical"
    predicted_delay: bool
    confidence: float = Field(..., ge=0, le=1)
    risk_factors: List[RiskFactor] = Field(default_factory=list)
    rule_score: float
    ml_score: float
    model_used: bool
    features: Optional[dict] = None
    nlp_analysis: Optional[dict] = None
