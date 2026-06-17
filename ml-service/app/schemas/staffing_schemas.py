"""
Staffing Analysis Schemas
Pydantic models for the /api/staffing/analyze endpoint.
"""

from typing import List, Optional
from pydantic import BaseModel, Field


# ── Input Models ──────────────────────────────────────────

class CommitAuthorInput(BaseModel):
    """Minimal commit object with author info for bus factor analysis."""
    author: str = "unknown"
    message: Optional[str] = None


class SprintHistoryInput(BaseModel):
    """A past sprint's data for historical analysis."""
    sprint_number: Optional[int] = None
    commits: List[CommitAuthorInput] = Field(default_factory=list)


class StaffingSprintInput(BaseModel):
    """Current sprint data for staffing analysis."""
    team_size: int = Field(default=5, ge=1)
    senior_dev_count: int = Field(default=0, ge=0)
    open_prs: int = Field(default=0, ge=0)
    open_tickets: int = Field(default=0, ge=0)
    avg_pr_review_lag_hours: float = Field(default=0, ge=0)
    changed_files: List[str] = Field(default_factory=list)
    commits: List[CommitAuthorInput] = Field(default_factory=list)
    backend_dev_count: Optional[int] = Field(default=None, ge=0)
    frontend_dev_count: Optional[int] = Field(default=None, ge=0)


class StaffingAnalysisInput(BaseModel):
    """Request body for staffing analysis."""
    sprint_data: StaffingSprintInput
    team_history: List[SprintHistoryInput] = Field(default_factory=list)

    class Config:
        json_schema_extra = {
            "example": {
                "sprint_data": {
                    "team_size": 8,
                    "senior_dev_count": 2,
                    "open_prs": 12,
                    "open_tickets": 25,
                    "avg_pr_review_lag_hours": 36,
                    "changed_files": [
                        "src/api/users.py", "src/api/auth.py",
                        "src/models/user.py", "frontend/Login.tsx",
                    ],
                    "commits": [
                        {"author": "alice", "message": "feat: user auth"},
                        {"author": "alice", "message": "fix: token refresh"},
                        {"author": "alice", "message": "feat: session mgmt"},
                        {"author": "bob", "message": "fix: login page"},
                        {"author": "charlie", "message": "docs: readme"},
                    ],
                    "backend_dev_count": 5,
                    "frontend_dev_count": 3,
                },
                "team_history": [
                    {
                        "sprint_number": 40,
                        "commits": [
                            {"author": "alice", "message": "feat: api endpoints"},
                            {"author": "alice", "message": "fix: database query"},
                        ],
                    }
                ],
            }
        }


# ── Output Models ─────────────────────────────────────────

class BottleneckDetail(BaseModel):
    """A detected staffing bottleneck."""
    type: str  # "reviewer_bottleneck", "bus_factor", "workload_overload", etc.
    severity: str  # "low", "medium", "high"
    metric: str
    description: str


class StaffingMetrics(BaseModel):
    """Computed staffing metrics."""
    active_prs_per_dev: float
    tickets_per_dev: float
    avg_pr_review_lag_hours: float
    team_size: int
    senior_dev_count: int


class StaffingAnalysisResponse(BaseModel):
    """Complete staffing analysis result."""
    bottlenecks: List[BottleneckDetail] = Field(default_factory=list)
    staffing_recommendation: str
    estimated_impact: str
    bus_factor_risk: bool = False
    critical_person: Optional[str] = None
    metrics: Optional[StaffingMetrics] = None
