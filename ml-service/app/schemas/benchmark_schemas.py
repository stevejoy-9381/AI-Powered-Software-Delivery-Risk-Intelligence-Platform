"""
Benchmark Schemas
Pydantic models for the /api/benchmark/compute endpoint.
"""

from typing import List, Optional
from pydantic import BaseModel, Field


# ── Input Models ──────────────────────────────────────────

class BenchmarkInput(BaseModel):
    """
    Team metrics data for computing delivery health score.
    All metrics are from the current sprint or rolling 30-day window.
    """
    # Velocity metrics
    velocity_points_completed: int = Field(default=0, ge=0)
    velocity_points_planned: int = Field(default=1, ge=1)
    sprint_completion_rate: Optional[float] = Field(
        default=None, ge=0, le=1,
        description="Fraction of planned work completed (0-1)"
    )

    # PR metrics
    avg_pr_cycle_time_hours: float = Field(default=24, ge=0)
    avg_pr_review_lag_hours: float = Field(default=12, ge=0)
    pr_merge_rate: Optional[float] = Field(
        default=None, ge=0, le=1,
        description="Fraction of PRs merged (vs closed/abandoned)"
    )

    # Code health
    code_churn_rate: float = Field(
        default=0.1, ge=0,
        description="(additions + deletions) / total lines"
    )
    test_coverage_percent: Optional[float] = Field(default=None, ge=0, le=100)

    # Team health
    team_size: int = Field(default=5, ge=1)
    blocked_ticket_ratio: float = Field(default=0, ge=0, le=1)
    scope_creep_ratio: float = Field(default=0, ge=0, le=1)
    reopen_rate: float = Field(default=0, ge=0, le=1)

    # Org averages (for percentile computation)
    org_avg_completion_rate: Optional[float] = Field(default=None, ge=0, le=1)
    org_avg_pr_cycle_time_hours: Optional[float] = Field(default=None, ge=0)
    org_avg_churn_rate: Optional[float] = Field(default=None, ge=0)

    class Config:
        json_schema_extra = {
            "example": {
                "velocity_points_completed": 28,
                "velocity_points_planned": 34,
                "sprint_completion_rate": 0.82,
                "avg_pr_cycle_time_hours": 18,
                "avg_pr_review_lag_hours": 8,
                "pr_merge_rate": 0.92,
                "code_churn_rate": 0.15,
                "test_coverage_percent": 72,
                "team_size": 6,
                "blocked_ticket_ratio": 0.08,
                "scope_creep_ratio": 0.12,
                "reopen_rate": 0.05,
                "org_avg_completion_rate": 0.75,
                "org_avg_pr_cycle_time_hours": 28,
                "org_avg_churn_rate": 0.18,
            }
        }


# ── Output Models ─────────────────────────────────────────

class BenchmarkCategory(BaseModel):
    """Score breakdown for a single health category."""
    category: str
    score: float = Field(..., ge=0, le=100)
    weight: float
    details: str


class BenchmarkResponse(BaseModel):
    """Complete delivery health benchmark result."""
    health_score: float = Field(..., ge=0, le=100)
    health_grade: str  # "A", "B", "C", "D", "F"
    percentile_vs_org: Optional[float] = Field(
        default=None, ge=0, le=100,
        description="Percentile rank vs organization average"
    )
    breakdown: List[BenchmarkCategory] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)
