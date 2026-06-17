"""
Risk Score Engine
Core risk computation module for the delivery risk platform.

Design Decision — Hybrid Scoring Approach:
We use a 40% rule-based + 60% ML model hybrid approach because:
1. Rule-based catches domain-specific patterns that ML might miss with limited training data
2. ML captures non-obvious correlations in the feature space
3. The hybrid ensures explainability (rules generate clear explanations)
4. If the ML model hasn't been trained yet, the rule-based component still works
5. This approach is more robust during early deployment when training data is sparse

The rule-based component also feeds the "risk_factors" explanation list,
which is critical for the platform's value prop — users need to know WHY
a sprint is at risk, not just that it IS at risk.
"""

from typing import Optional
from loguru import logger


# ═══════════════════════════════════════════════════════════
# RULE-BASED SCORING
# ═══════════════════════════════════════════════════════════

def compute_rule_based_score(features: dict, context: dict = None) -> tuple:
    """
    Compute rule-based risk score from sprint features.

    Each rule adds points based on specific warning signals.
    Maximum score is capped at 100.

    Args:
        features: Dictionary of computed features from feature_engineering.
        context: Optional additional context (commit risk analysis, NLP results).

    Returns:
        (score: int, triggered_rules: list of dict)
    """
    score = 0
    triggered_rules = []
    context = context or {}

    # ── Rule 1: PR Review Lag ─────────────────────────────
    # If review lag is > 2x team average, reviews are blocking progress
    pr_review_lag_ratio = features.get("pr_review_lag_ratio", 1.0)
    if pr_review_lag_ratio > 2.0:
        points = 25
        score += points
        triggered_rules.append({
            "rule": "pr_review_lag",
            "points": points,
            "severity": "high",
            "factor": "PR Review Lag",
            "description": (
                f"PR review lag is {pr_review_lag_ratio:.1f}x your team average "
                f"— reviews are blocking merges"
            ),
        })

    # ── Rule 2: Commit Frequency Drop ─────────────────────
    # A sharp drop in commits suggests the team is stuck
    commit_zscore = features.get("commit_frequency_zscore", 0)
    if commit_zscore < -1.5:  # More than 1.5 std below average
        points = 20
        score += points
        drop_pct = abs(commit_zscore) * 30  # Rough percentage estimate
        triggered_rules.append({
            "rule": "commit_frequency_drop",
            "points": points,
            "severity": "high",
            "factor": "Commit Drop",
            "description": (
                f"Commit frequency dropped ~{drop_pct:.0f}% below team average "
                f"— team may be stuck or blocked"
            ),
        })

    # ── Rule 3: Ticket Reopens ────────────────────────────
    # Reopened tickets signal quality issues
    reopen_rate = features.get("reopen_rate", 0)
    ticket_count = features.get("ticket_count", 0)
    reopened_count = int(reopen_rate * ticket_count)
    if reopened_count >= 3:
        points = 15
        score += points
        triggered_rules.append({
            "rule": "ticket_reopens",
            "points": points,
            "severity": "medium",
            "factor": "Ticket Reopens",
            "description": (
                f"{reopened_count} tickets have been reopened "
                f"— unclear requirements or quality issues"
            ),
        })

    # ── Rule 4: Scope Creep ───────────────────────────────
    # Tickets added mid-sprint expand the scope
    scope_creep_score = features.get("scope_creep_score", 0)
    if scope_creep_score > 0.2:  # >20% of tickets added mid-sprint
        points = 20
        score += points
        pct = scope_creep_score * 100
        triggered_rules.append({
            "rule": "scope_creep",
            "points": points,
            "severity": "high" if scope_creep_score > 0.35 else "medium",
            "factor": "Scope Creep",
            "description": (
                f"{pct:.0f}% of tickets were added mid-sprint "
                f"— original scope expanded significantly"
            ),
        })

    # ── Rule 5: Emergency/Hotfix Commits ──────────────────
    emergency_commits = context.get("emergency_commits", 0)
    high_risk_commits = context.get("high_risk_commits", 0)
    if emergency_commits >= 2:
        points = 15
        score += points
        triggered_rules.append({
            "rule": "emergency_commits",
            "points": points,
            "severity": "high",
            "factor": "Emergency Commits",
            "description": (
                f"{emergency_commits} emergency/hotfix commits detected "
                f"— team is firefighting instead of building"
            ),
        })
    elif high_risk_commits >= 3:
        points = 10
        score += points
        triggered_rules.append({
            "rule": "high_risk_commits",
            "points": points,
            "severity": "medium",
            "factor": "High-Risk Changes",
            "description": (
                f"{high_risk_commits} commits touch security/auth/payment code "
                f"— increased testing and review needed"
            ),
        })

    # ── Rule 6: Negative Sentiment ────────────────────────
    sentiment = features.get("sentiment_score", 0)
    if sentiment < -0.3:
        points = 15
        score += points
        triggered_rules.append({
            "rule": "negative_sentiment",
            "points": points,
            "severity": "medium",
            "factor": "Negative Sentiment",
            "description": (
                f"Commit and ticket language shows frustration/blockers "
                f"(sentiment: {sentiment:.2f}) — team morale may be impacted"
            ),
        })

    # ── Rule 7: Blocked Tickets ───────────────────────────
    blocked_ratio = features.get("blocked_ratio", 0)
    if blocked_ratio > 0.25:
        points = 10
        score += points
        blocked_pct = blocked_ratio * 100
        triggered_rules.append({
            "rule": "blocked_tickets",
            "points": points,
            "severity": "medium",
            "factor": "Blocked Tickets",
            "description": (
                f"{blocked_pct:.0f}% of tickets are blocked "
                f"— dependencies or external teams may be delaying progress"
            ),
        })

    # ── Rule 8: Low Velocity Trend ────────────────────────
    velocity_trend = features.get("velocity_trend", 1.0)
    if velocity_trend < 0.7:
        points = 15
        score += points
        triggered_rules.append({
            "rule": "low_velocity",
            "points": points,
            "severity": "high" if velocity_trend < 0.5 else "medium",
            "factor": "Declining Velocity",
            "description": (
                f"Sprint velocity is {velocity_trend:.0%} of the 3-sprint average "
                f"— team is completing significantly fewer points than usual"
            ),
        })

    # ── Rule 9: High Time Pressure ────────────────────────
    days_pressure = features.get("days_pressure", 0.5)
    completion_pct = features.get("completed_points", 0) / max(features.get("planned_points", 1), 1)
    if days_pressure < 0.3 and completion_pct < 0.6:
        points = 15
        score += points
        triggered_rules.append({
            "rule": "time_pressure",
            "points": points,
            "severity": "high",
            "factor": "Time Pressure",
            "description": (
                f"Only {days_pressure:.0%} of sprint time remains but "
                f"{completion_pct:.0%} of work is complete — at risk of missing deadline"
            ),
        })

    # Cap at 100
    score = min(score, 100)

    return score, triggered_rules


# ═══════════════════════════════════════════════════════════
# ML MODEL SCORING
# ═══════════════════════════════════════════════════════════

def compute_ml_score(features: dict, model=None) -> tuple:
    """
    Compute ML-based risk score using the trained XGBoost model.

    Args:
        features: Dictionary of computed features.
        model: Loaded ML model (XGBoost classifier).

    Returns:
        (ml_score: float 0-100, confidence: float 0-1)
    """
    from app.utils.feature_engineering import FEATURE_COLUMNS
    import numpy as np

    if model is None:
        logger.warning("No ML model available — using rule-based score only")
        return 50.0, 0.0  # Neutral score with zero confidence

    try:
        # Build feature vector in the correct order
        feature_vector = np.array([
            features.get(col, 0.0) for col in FEATURE_COLUMNS
        ]).reshape(1, -1)

        # Get probability of delay (class 1)
        probabilities = model.predict_proba(feature_vector)[0]
        delay_probability = float(probabilities[1]) if len(probabilities) > 1 else float(probabilities[0])

        # ML score = delay probability * 100
        ml_score = delay_probability * 100

        # Confidence = how far the probability is from 0.5 (uncertain)
        confidence = abs(delay_probability - 0.5) * 2  # 0 at 0.5, 1 at 0 or 1

        return round(ml_score, 2), round(confidence, 4)

    except Exception as e:
        logger.error(f"ML prediction failed: {e}")
        return 50.0, 0.0


# ═══════════════════════════════════════════════════════════
# COMBINED RISK SCORING
# ═══════════════════════════════════════════════════════════

def compute_risk_score(
    features: dict,
    context: dict = None,
    model=None,
    rule_weight: float = 0.4,
    ml_weight: float = 0.6,
) -> dict:
    """
    Compute the final hybrid risk score.

    final_risk_score = (rule_weight × rule_score) + (ml_weight × ml_score)

    Args:
        features: Feature dictionary from feature_engineering.extract_features()
        context: Additional context (NLP results, commit analysis)
        model: Trained ML model (or None for rule-only)
        rule_weight: Weight for rule-based component (default 0.4)
        ml_weight: Weight for ML component (default 0.6)

    Returns:
        Complete risk assessment dictionary.
    """
    context = context or {}

    # ── Compute both components ───────────────────────────
    rule_score, triggered_rules = compute_rule_based_score(features, context)
    ml_score, confidence = compute_ml_score(features, model)

    # ── Combine scores ────────────────────────────────────
    if model is not None:
        final_score = (rule_weight * rule_score) + (ml_weight * ml_score)
    else:
        # If no ML model, use rule-based only
        final_score = rule_score
        confidence = 0.0

    final_score = round(min(max(final_score, 0), 100), 2)

    # ── Map to risk level ─────────────────────────────────
    if final_score >= 76:
        risk_level = "critical"
    elif final_score >= 51:
        risk_level = "high"
    elif final_score >= 26:
        risk_level = "medium"
    else:
        risk_level = "low"

    # ── Determine if delay is predicted ───────────────────
    predicted_delay = final_score >= 50

    return {
        "risk_score": final_score,
        "risk_level": risk_level,
        "predicted_delay": predicted_delay,
        "confidence": confidence,
        "rule_score": rule_score,
        "ml_score": round(ml_score, 2),
        "risk_factors": triggered_rules,
        "model_used": model is not None,
    }


# ═══════════════════════════════════════════════════════════
# EXPLANATION GENERATOR
# ═══════════════════════════════════════════════════════════

def generate_risk_factors(features: dict, rule_scores: list) -> list:
    """
    Generate a prioritized list of risk factor explanations.

    Sorts by severity (critical > high > medium > low) and then by points.

    Args:
        features: Feature dictionary.
        rule_scores: List of triggered rule dictionaries.

    Returns:
        Sorted list of risk factor explanations.
    """
    severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}

    sorted_factors = sorted(
        rule_scores,
        key=lambda x: (severity_order.get(x.get("severity", "low"), 3), -x.get("points", 0)),
    )

    # Return clean explanation objects (without internal scoring details)
    return [
        {
            "factor": f["factor"],
            "severity": f["severity"],
            "description": f["description"],
        }
        for f in sorted_factors
    ]
