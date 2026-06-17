"""
Benchmark Router
POST /api/benchmark/compute — Computes team delivery health score (0-100).

The health score is a weighted composite of 5 categories:
1. Velocity (25%) — sprint completion rate
2. PR Health (25%) — cycle time, review lag, merge rate
3. Code Quality (20%) — churn rate, test coverage
4. Process Health (20%) — blocked ratio, scope creep, reopen rate
5. Team Capacity (10%) — workload balance
"""

import time
from fastapi import APIRouter
from loguru import logger

from app.schemas.common import APIResponse
from app.schemas.benchmark_schemas import (
    BenchmarkInput,
    BenchmarkResponse,
    BenchmarkCategory,
)

router = APIRouter(prefix="/api/benchmark", tags=["Team Benchmarking"])


def _compute_health_score(data: dict) -> dict:
    """
    Compute delivery health score from team metrics.

    Returns health score (0-100), grade, breakdown, and recommendations.
    """
    recommendations = []

    # ── 1. Velocity Score (25%) ─────────────────────────────
    completion_rate = data.get("sprint_completion_rate")
    if completion_rate is None:
        completed = data.get("velocity_points_completed", 0)
        planned = data.get("velocity_points_planned", 1)
        completion_rate = completed / max(planned, 1)

    # Score: 100 if completion >= 90%, scales down linearly
    velocity_score = min(100, (completion_rate / 0.9) * 100)
    velocity_details = f"Sprint completion: {completion_rate:.0%}"

    if completion_rate < 0.7:
        recommendations.append(
            "Sprint completion is below 70% — consider reducing planned scope"
        )

    # ── 2. PR Health Score (25%) ────────────────────────────
    pr_cycle_time = data.get("avg_pr_cycle_time_hours", 24)
    pr_review_lag = data.get("avg_pr_review_lag_hours", 12)
    pr_merge_rate = data.get("pr_merge_rate", 0.9)

    # Ideal: cycle < 24h, review lag < 8h, merge rate > 90%
    cycle_score = max(0, 100 - max(0, pr_cycle_time - 24) * 2)
    lag_score = max(0, 100 - max(0, pr_review_lag - 8) * 3)
    merge_score = (pr_merge_rate or 0.9) * 100

    pr_health_score = (cycle_score * 0.4 + lag_score * 0.4 + merge_score * 0.2)
    pr_details = (
        f"Cycle time: {pr_cycle_time:.0f}h, "
        f"Review lag: {pr_review_lag:.0f}h, "
        f"Merge rate: {(pr_merge_rate or 0):.0%}"
    )

    if pr_review_lag > 24:
        recommendations.append(
            f"PR review lag is {pr_review_lag:.0f}h — aim for under 8 hours"
        )
    if pr_cycle_time > 48:
        recommendations.append(
            f"PR cycle time is {pr_cycle_time:.0f}h — consider smaller PRs"
        )

    # ── 3. Code Quality Score (20%) ────────────────────────
    churn_rate = data.get("code_churn_rate", 0.1)
    test_coverage = data.get("test_coverage_percent")

    # Lower churn is better (ideal < 0.15)
    churn_score = max(0, 100 - max(0, churn_rate - 0.15) * 300)

    # Higher coverage is better (ideal > 80%)
    if test_coverage is not None:
        coverage_score = min(100, test_coverage / 80 * 100)
    else:
        coverage_score = 50  # Unknown = neutral

    code_quality_score = churn_score * 0.5 + coverage_score * 0.5
    coverage_str = f"{test_coverage:.0f}%" if test_coverage is not None else "unknown"
    code_details = f"Churn rate: {churn_rate:.2f}, Test coverage: {coverage_str}"

    if test_coverage is not None and test_coverage < 60:
        recommendations.append(
            f"Test coverage is {test_coverage:.0f}% — target 80%+"
        )

    # ── 4. Process Health Score (20%) ──────────────────────
    blocked_ratio = data.get("blocked_ticket_ratio", 0)
    scope_creep = data.get("scope_creep_ratio", 0)
    reopen_rate = data.get("reopen_rate", 0)

    # Lower is better for all three
    blocked_score = max(0, 100 - blocked_ratio * 300)
    scope_score = max(0, 100 - scope_creep * 300)
    reopen_score = max(0, 100 - reopen_rate * 400)

    process_health_score = (
        blocked_score * 0.35 + scope_score * 0.35 + reopen_score * 0.3
    )
    process_details = (
        f"Blocked: {blocked_ratio:.0%}, "
        f"Scope creep: {scope_creep:.0%}, "
        f"Reopen rate: {reopen_rate:.0%}"
    )

    if scope_creep > 0.2:
        recommendations.append(
            f"Scope creep at {scope_creep:.0%} — tighten sprint planning"
        )

    # ── 5. Team Capacity Score (10%) ───────────────────────
    team_size = data.get("team_size", 5)
    # Simple heuristic: ideal team is 4-8
    if 4 <= team_size <= 8:
        capacity_score = 100
    elif team_size < 4:
        capacity_score = max(50, team_size / 4 * 100)
    else:
        capacity_score = max(50, 100 - (team_size - 8) * 10)

    capacity_details = f"Team size: {team_size}"

    # ── Weighted total ─────────────────────────────────────
    health_score = (
        velocity_score * 0.25
        + pr_health_score * 0.25
        + code_quality_score * 0.20
        + process_health_score * 0.20
        + capacity_score * 0.10
    )
    health_score = round(min(max(health_score, 0), 100), 1)

    # ── Grade mapping ──────────────────────────────────────
    if health_score >= 90:
        grade = "A"
    elif health_score >= 75:
        grade = "B"
    elif health_score >= 60:
        grade = "C"
    elif health_score >= 40:
        grade = "D"
    else:
        grade = "F"

    # ── Percentile vs org average ──────────────────────────
    percentile = None
    org_avg_completion = data.get("org_avg_completion_rate")
    if org_avg_completion is not None and org_avg_completion > 0:
        # Simple percentile: how does this team compare to org average?
        ratio = completion_rate / org_avg_completion
        # Map ratio to percentile (1.0 = 50th percentile, 1.2 = ~80th, etc.)
        percentile = min(99, max(1, round(50 * ratio)))

    # ── Build breakdown ────────────────────────────────────
    breakdown = [
        BenchmarkCategory(
            category="Velocity",
            score=round(velocity_score, 1),
            weight=0.25,
            details=velocity_details,
        ),
        BenchmarkCategory(
            category="PR Health",
            score=round(pr_health_score, 1),
            weight=0.25,
            details=pr_details,
        ),
        BenchmarkCategory(
            category="Code Quality",
            score=round(code_quality_score, 1),
            weight=0.20,
            details=code_details,
        ),
        BenchmarkCategory(
            category="Process Health",
            score=round(process_health_score, 1),
            weight=0.20,
            details=process_details,
        ),
        BenchmarkCategory(
            category="Team Capacity",
            score=round(capacity_score, 1),
            weight=0.10,
            details=capacity_details,
        ),
    ]

    return {
        "health_score": health_score,
        "health_grade": grade,
        "percentile_vs_org": percentile,
        "breakdown": breakdown,
        "recommendations": recommendations,
    }


@router.post("/compute", response_model=APIResponse)
async def compute_benchmark(body: BenchmarkInput):
    """
    Compute delivery health score for a team.

    Evaluates 5 categories:
    - Velocity (25%): Sprint completion rate
    - PR Health (25%): Cycle time, review lag, merge rate
    - Code Quality (20%): Churn rate, test coverage
    - Process Health (20%): Blocked ratio, scope creep, reopens
    - Team Capacity (10%): Team size balance

    Returns health score (0-100), letter grade, percentile vs org, breakdown.
    """
    start_time = time.time()

    try:
        data = body.model_dump()
        result = _compute_health_score(data)

        response_data = BenchmarkResponse(**result)

        elapsed = round(time.time() - start_time, 3)
        logger.info(
            f"Benchmark computed: {result['health_score']}/100 "
            f"(grade {result['health_grade']}) in {elapsed}s"
        )

        return APIResponse(success=True, data=response_data.model_dump())

    except Exception as e:
        elapsed = round(time.time() - start_time, 3)
        logger.error(f"Benchmark computation failed after {elapsed}s: {e}")
        return APIResponse(success=False, error=str(e))
