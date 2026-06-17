"""
Feature Engineering Module
Transforms raw sprint data from MongoDB into ML-ready feature vectors.

Each feature is designed to capture a specific delivery risk signal:
- Commit patterns (velocity, drops)
- PR health (review lag, cycle time)
- Scope stability (creep, reopens)
- Team capacity (utilization, pressure)
- Sentiment (from NLP analysis of commit/ticket text)
"""

import pandas as pd
import numpy as np
from typing import Optional


def extract_features(sprint_data: dict) -> dict:
    """
    Extract ML features from a single sprint's raw data.

    Args:
        sprint_data: Dictionary containing sprint fields from MongoDB.
                     Expected keys: tickets, commits, pullRequests, plannedPoints,
                     completedPoints, startDate, endDate, teamSize, etc.

    Returns:
        Dictionary of computed feature values ready for model input.
    """
    # ── Safely extract raw values ─────────────────────────
    tickets = sprint_data.get("tickets", [])
    commits = sprint_data.get("commits", [])
    pull_requests = sprint_data.get("pullRequests", [])
    planned_points = sprint_data.get("plannedPoints", 0) or 1  # avoid div by zero
    completed_points = sprint_data.get("completedPoints", 0)
    team_size = sprint_data.get("teamSize", 1) or 1
    sprint_days = sprint_data.get("sprintDays", 14) or 14
    days_remaining = sprint_data.get("daysRemaining", 7)

    # Historical context (may not always be available)
    team_avg_commit_freq = sprint_data.get("teamAvgCommitFrequency", None)
    team_avg_pr_review_lag = sprint_data.get("teamAvgPrReviewLag", None)
    prev_sprint_velocities = sprint_data.get("previousVelocities", [])

    # ── Feature 1: Commit Frequency Z-Score ───────────────
    # How unusual is this sprint's commit rate vs team average?
    commit_count = len(commits)
    commit_frequency = commit_count / max(sprint_days, 1)

    if team_avg_commit_freq and team_avg_commit_freq > 0:
        # Simple z-score: (observed - mean) / std_estimate
        # Using 30% of mean as a rough std estimate when we don't have true std
        std_estimate = team_avg_commit_freq * 0.3
        commit_frequency_zscore = (
            (commit_frequency - team_avg_commit_freq) / max(std_estimate, 0.1)
        )
    else:
        commit_frequency_zscore = 0.0

    # ── Feature 2: PR Review Lag Ratio ────────────────────
    # How does current review lag compare to team average?
    pr_review_lags = [
        pr.get("reviewLagHours", 0)
        for pr in pull_requests
        if pr.get("reviewLagHours") is not None
    ]
    avg_pr_review_lag = np.mean(pr_review_lags) if pr_review_lags else 0

    if team_avg_pr_review_lag and team_avg_pr_review_lag > 0:
        pr_review_lag_ratio = avg_pr_review_lag / team_avg_pr_review_lag
    else:
        pr_review_lag_ratio = 1.0  # Neutral if no baseline

    # ── Feature 3: Code Churn Rate ────────────────────────
    # High churn = lots of rewriting = potential instability
    total_additions = sum(c.get("additions", 0) for c in commits)
    total_deletions = sum(c.get("deletions", 0) for c in commits)
    total_changes = total_additions + total_deletions
    churn_rate = total_changes / max(total_additions, 1)  # ratio of changes to additions

    # ── Feature 4: Scope Creep Score ──────────────────────
    # What fraction of tickets were added after the sprint started?
    total_tickets = len(tickets)
    mid_sprint_tickets = sum(
        1 for t in tickets if t.get("addedMidSprint", False)
    )
    scope_creep_score = mid_sprint_tickets / max(total_tickets, 1)

    # ── Feature 5: Reopen Rate ────────────────────────────
    # Reopened tickets signal quality issues or unclear requirements
    reopened_tickets = sum(
        1 for t in tickets if t.get("reopenedCount", 0) > 0
    )
    reopen_rate = reopened_tickets / max(total_tickets, 1)

    # ── Feature 6: Velocity Trend ─────────────────────────
    # How does recent velocity compare to historical?
    if prev_sprint_velocities and len(prev_sprint_velocities) > 0:
        avg_prev_velocity = np.mean(prev_sprint_velocities)
        current_velocity = completed_points / max(planned_points, 1)
        velocity_trend = current_velocity / max(avg_prev_velocity, 0.1)
    else:
        velocity_trend = 1.0  # Neutral if no history

    # ── Feature 7: Blocked Ratio ──────────────────────────
    blocked_tickets = sum(
        1 for t in tickets if t.get("status") == "blocked"
    )
    blocked_ratio = blocked_tickets / max(total_tickets, 1)

    # ── Feature 8: Days Pressure ──────────────────────────
    # Lower = more time pressure (approaching deadline)
    days_pressure = days_remaining / max(sprint_days, 1)

    # ── Feature 9: Team Utilization ───────────────────────
    # How loaded is each team member?
    active_prs = sum(
        1 for pr in pull_requests if pr.get("status") == "open"
    )
    active_tickets = sum(
        1 for t in tickets if t.get("status") in ("in_progress", "in_review")
    )
    team_utilization = (active_prs + active_tickets) / max(team_size, 1)

    # ── Feature 10: Sentiment Score ───────────────────────
    # This comes from the NLP module — use provided value or default to 0
    sentiment_score = sprint_data.get("sentimentScore", 0.0)

    # ── Ground truth label (for training only) ────────────
    risk_label = 1 if sprint_data.get("wasDelayed", False) else 0

    return {
        "commit_frequency_zscore": round(float(commit_frequency_zscore), 4),
        "pr_review_lag_ratio": round(float(pr_review_lag_ratio), 4),
        "churn_rate": round(float(churn_rate), 4),
        "scope_creep_score": round(float(scope_creep_score), 4),
        "reopen_rate": round(float(reopen_rate), 4),
        "velocity_trend": round(float(velocity_trend), 4),
        "blocked_ratio": round(float(blocked_ratio), 4),
        "days_pressure": round(float(days_pressure), 4),
        "team_utilization": round(float(team_utilization), 4),
        "sentiment_score": round(float(sentiment_score), 4),
        # Metadata (not model features, but useful for context)
        "planned_points": planned_points,
        "completed_points": completed_points,
        "team_size": team_size,
        "commit_count": commit_count,
        "pr_count": len(pull_requests),
        "ticket_count": total_tickets,
        # Training label
        "risk_label": risk_label,
    }


# The 10 features used by the ML model (order matters for consistency)
FEATURE_COLUMNS = [
    "commit_frequency_zscore",
    "pr_review_lag_ratio",
    "churn_rate",
    "scope_creep_score",
    "reopen_rate",
    "velocity_trend",
    "blocked_ratio",
    "days_pressure",
    "team_utilization",
    "sentiment_score",
]


def extract_features_batch(sprints: list) -> pd.DataFrame:
    """
    Extract features from multiple sprints into a DataFrame.

    Args:
        sprints: List of sprint data dictionaries.

    Returns:
        pandas DataFrame with one row per sprint and all feature columns.
    """
    rows = [extract_features(s) for s in sprints]
    df = pd.DataFrame(rows)

    # Replace any NaN/inf values with 0
    df = df.replace([np.inf, -np.inf], np.nan).fillna(0)

    return df


def get_feature_matrix(df: pd.DataFrame) -> tuple:
    """
    Extract the feature matrix X and target vector y from a features DataFrame.

    Returns:
        (X, y) where X is a numpy array of features and y is the target labels.
    """
    available_cols = [c for c in FEATURE_COLUMNS if c in df.columns]
    X = df[available_cols].values
    y = df["risk_label"].values if "risk_label" in df.columns else None
    return X, y
