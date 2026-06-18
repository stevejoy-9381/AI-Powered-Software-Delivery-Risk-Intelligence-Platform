"""
Release Readiness Schemas
Pydantic models for the /api/release/predict endpoint.
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class ReleasePredictInput(BaseModel):
    """Input features for release readiness prediction."""
    sprint_risk_score: float = Field(..., ge=0, le=100, description="Risk score of the active sprint (0-100)")
    hotspot_count: int = Field(default=0, ge=0, description="Number of flagged codebase hotspots")
    critical_pr_count: int = Field(default=0, ge=0, description="Number of open critical pull requests")
    days_remaining: int = Field(default=7, ge=0, description="Days remaining in the active sprint")

    class Config:
        json_schema_extra = {
            "example": {
                "sprint_risk_score": 45.5,
                "hotspot_count": 3,
                "critical_pr_count": 2,
                "days_remaining": 5
            }
        }


class ReleasePredictResponse(BaseModel):
    """Prediction output for release readiness."""
    readiness_score: float = Field(..., ge=0, le=100, description="Calculated readiness score (0-100)")
    predicted_delay_probability: float = Field(..., ge=0, le=1, description="Model probability of release delay")
    blockers: List[str] = Field(default_factory=list, description="List of identified release blockers")
    recommendation: str = Field(..., description="Actionable recommendation description")
    model_used: bool = Field(default=False, description="True if ML model was utilized for prediction")
