"""
Hotspot Analysis Schemas
Pydantic models for the /api/hotspots/analyze endpoint.
"""

from typing import List, Optional
from pydantic import BaseModel, Field


# ── Input Models ──────────────────────────────────────────

class FileDataInput(BaseModel):
    """Metadata for a single codebase file."""
    file_path: str
    churn_count: int = Field(default=0, ge=0, description="Modifications in last 30 days")
    has_tests: bool = True
    test_coverage_percent: Optional[float] = Field(
        default=None, ge=0, le=100,
        description="Test coverage percentage (0-100), None if unknown"
    )
    authors_count: int = Field(default=1, ge=1, description="Unique contributors")
    is_critical_path: bool = Field(
        default=False,
        description="Whether file is in auth/payment/core logic"
    )
    last_modified_days_ago: int = Field(default=0, ge=0)
    complexity_score: float = Field(
        default=0.0, ge=0, le=100,
        description="Cognitive/cyclomatic complexity estimate (0-100)"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "file_path": "src/auth/oauth2.py",
                "churn_count": 15,
                "has_tests": False,
                "test_coverage_percent": None,
                "authors_count": 4,
                "is_critical_path": True,
                "last_modified_days_ago": 2,
            }
        }


class HotspotAnalysisRequest(BaseModel):
    """Request body for hotspot analysis — list of files to analyze."""
    files: List[FileDataInput] = Field(..., min_length=1)


# ── Output Models ─────────────────────────────────────────

class HotspotBreakdown(BaseModel):
    """Score breakdown for a single file."""
    churn_score: float
    test_penalty: float
    authors_score: float
    critical_bonus: float
    complexity_score: float


class HotspotResult(BaseModel):
    """Analysis result for a single file."""
    file_path: str
    hotspot_score: float = Field(..., ge=0, le=100)
    is_hotspot: bool
    rank: int
    reasons: List[str]
    breakdown: HotspotBreakdown
    complexity_score: float = 0.0


class HotspotAnalysisResponse(BaseModel):
    """Complete hotspot analysis result."""
    total_files_analyzed: int
    hotspot_count: int
    hotspots: List[HotspotResult]
