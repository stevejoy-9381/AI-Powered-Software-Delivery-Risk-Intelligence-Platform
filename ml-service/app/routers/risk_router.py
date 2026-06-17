"""
Risk Score Router
POST /api/risk/score — Computes sprint delay risk using the full ML pipeline.

Flow: sprint data → feature engineering → NLP analysis → risk engine → response
"""

import time
from fastapi import APIRouter, Request
from loguru import logger

from app.schemas.common import APIResponse
from app.schemas.risk_schemas import SprintDataInput, RiskScoreResponse
from app.utils.feature_engineering import extract_features
from app.utils.nlp_analyzer import (
    compute_sentiment_score,
    classify_commit_risk,
    detect_scope_creep_from_text,
)
from app.utils.risk_engine import compute_risk_score, generate_risk_factors

router = APIRouter(prefix="/api/risk", tags=["Risk Assessment"])


@router.post("/score", response_model=APIResponse)
async def score_sprint_risk(body: SprintDataInput, request: Request):
    """
    Compute the sprint delay risk score.

    Accepts full sprint data, runs it through:
    1. Feature engineering (10 ML features)
    2. NLP analysis (sentiment, commit risk, scope creep)
    3. Risk engine (40% rule-based + 60% ML hybrid)

    Returns risk score (0-100), risk level, explanations, and prediction.
    """
    start_time = time.time()

    try:
        # Convert Pydantic model to dict for internal processing
        sprint_dict = body.model_dump()

        # ── Step 1: NLP Analysis ───────────────────────────
        # Compute sentiment from commit messages and ticket titles
        commit_messages = [
            c.get("message", "") for c in sprint_dict.get("commits", [])
            if c.get("message")
        ]
        ticket_titles = [
            t.get("title", "") for t in sprint_dict.get("tickets", [])
            if t.get("title")
        ]
        all_texts = commit_messages + ticket_titles

        sentiment_score = compute_sentiment_score(all_texts)
        sprint_dict["sentimentScore"] = sentiment_score

        # Classify commit risk
        commit_risk = classify_commit_risk(commit_messages)

        # Detect scope creep from ticket descriptions
        ticket_descriptions = [
            t.get("description") or t.get("title", "")
            for t in sprint_dict.get("tickets", [])
        ]
        scope_creep = detect_scope_creep_from_text(
            ticket_descriptions,
            sprint_goal=sprint_dict.get("sprintGoal", ""),
        )

        # ── Step 2: Feature Engineering ────────────────────
        features = extract_features(sprint_dict)

        # ── Step 3: Risk Scoring ───────────────────────────
        # Get the loaded ML model from app state (loaded at startup)
        ml_model = getattr(request.app.state, "ml_model", None)

        # Build context from NLP results
        context = {
            "emergency_commits": commit_risk.get("emergency_commits", 0),
            "high_risk_commits": commit_risk.get("high_risk_commits", 0),
        }

        risk_result = compute_risk_score(
            features=features,
            context=context,
            model=ml_model,
        )

        # ── Step 4: Generate explanations ──────────────────
        risk_factors = generate_risk_factors(
            features, risk_result.get("risk_factors", [])
        )

        # ── Build response ─────────────────────────────────
        response_data = RiskScoreResponse(
            risk_score=risk_result["risk_score"],
            risk_level=risk_result["risk_level"],
            predicted_delay=risk_result["predicted_delay"],
            confidence=risk_result["confidence"],
            risk_factors=risk_factors,
            rule_score=risk_result["rule_score"],
            ml_score=risk_result["ml_score"],
            model_used=risk_result["model_used"],
            features=features,
            nlp_analysis={
                "sentiment_score": sentiment_score,
                "commit_risk": commit_risk,
                "scope_creep": scope_creep,
            },
        )

        elapsed = round(time.time() - start_time, 3)
        logger.info(
            f"Risk score computed: {risk_result['risk_score']} "
            f"({risk_result['risk_level']}) in {elapsed}s"
        )

        return APIResponse(success=True, data=response_data.model_dump())

    except Exception as e:
        elapsed = round(time.time() - start_time, 3)
        logger.error(f"Risk scoring failed after {elapsed}s: {e}")
        return APIResponse(success=False, error=str(e))
