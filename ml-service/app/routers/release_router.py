"""
Release Readiness Router
POST /api/release/predict — Predicts release readiness using rules and the LightGBM release model.
"""

import time
from fastapi import APIRouter, Request
from loguru import logger

from app.schemas.common import APIResponse
from app.schemas.release_schemas import ReleasePredictInput, ReleasePredictResponse

router = APIRouter(prefix="/api/release", tags=["Release Readiness"])


def compute_rule_based_readiness(data: dict) -> tuple:
    """Compute rule-based readiness score and identify blockers using 4 specific deductions."""
    sprint_risk = data.get("sprint_risk_score", 0)
    hotspot_count = data.get("hotspot_count", 0)
    critical_pr_count = data.get("critical_pr_count", 0)
    days_remaining = data.get("days_remaining", 7)

    blockers = []
    risk_points = 0

    if sprint_risk > 50:
        risk_points += 30
        blockers.append(f"Active sprint at high risk (score: {sprint_risk:.1f})")

    if hotspot_count > 5:
        risk_points += 20
        blockers.append(f"{hotspot_count} codebase hotspots flagged")

    if critical_pr_count > 0:
        deduction = 15 * min(critical_pr_count, 3)
        risk_points += deduction
        blockers.append(f"{critical_pr_count} open critical PR(s) need review")

    if days_remaining <= 2:
        risk_points += 15
        blockers.append(f"Only {days_remaining} day(s) remaining in sprint")

    readiness_score = max(0.0, 100.0 - risk_points)
    return readiness_score, blockers


@router.post("/predict", response_model=APIResponse)
async def predict_release_readiness(body: ReleasePredictInput, request: Request):
    """
    Predict release readiness.
    Uses a hybrid approach:
    - 40% weight on rule-based readiness deductions
    - 60% weight on the trained LightGBM release model's probability output
    """
    start_time = time.time()

    try:
        input_dict = body.model_dump()
        
        # ── 1. Compute Rule-Based Score ──────────────────
        rule_score, blockers = compute_rule_based_readiness(input_dict)

        # ── 2. Compute ML Score ──────────────────────────
        release_model = getattr(request.app.state, "release_model", None)
        model_used = release_model is not None
        delay_prob = 0.5
        ml_score = 50.0

        if model_used:
            try:
                import numpy as np
                # Input features: sprint_risk_score, hotspot_count, critical_pr_count, days_remaining
                features = np.array([[
                    input_dict["sprint_risk_score"],
                    input_dict["hotspot_count"],
                    input_dict["critical_pr_count"],
                    input_dict["days_remaining"]
                ]])
                
                # Predict probability of delay (class 1)
                probabilities = release_model.predict_proba(features)[0]
                delay_prob = float(probabilities[1]) if len(probabilities) > 1 else float(probabilities[0])
                
                # ML readiness score is the inverse of delay probability
                ml_score = (1.0 - delay_prob) * 100.0
            except Exception as e:
                logger.error(f"ML release prediction failed: {e}")
                model_used = False

        # ── 3. Combine scores (40% rules / 60% ML) ───────
        if model_used:
            final_score = (0.4 * rule_score) + (0.6 * ml_score)
        else:
            final_score = rule_score
            delay_prob = 1.0 - (rule_score / 100.0)

        final_score = round(min(max(final_score, 0.0), 100.0), 1)

        # ── 4. Set recommendations ───────────────────────
        if final_score >= 80:
            recommendation = "Release looks good — no major blockers detected."
        elif final_score >= 50:
            recommendation = "Some risks identified — review blockers before releasing."
        else:
            recommendation = "High risk — address critical blockers before considering release."

        response_data = ReleasePredictResponse(
            readiness_score=final_score,
            predicted_delay_probability=round(delay_prob, 4),
            blockers=blockers,
            recommendation=recommendation,
            model_used=model_used
        )

        elapsed = round(time.time() - start_time, 3)
        logger.info(
            f"Release readiness predicted: score={final_score}% "
            f"(delay prob={delay_prob:.2f}) in {elapsed}s"
        )

        return APIResponse(success=True, data=response_data.model_dump())

    except Exception as e:
        elapsed = round(time.time() - start_time, 3)
        logger.error(f"Release prediction failed after {elapsed}s: {e}")
        return APIResponse(success=False, error=str(e))
