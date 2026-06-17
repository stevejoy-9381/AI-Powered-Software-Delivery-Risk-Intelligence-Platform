"""
Hotspot Analyzer Module
Analyzes codebase files to detect "fragile zones" — files at high risk of causing bugs.

The hotspot score is a weighted composite of four signals:
- Churn (40 pts max): Files changed frequently are more likely to introduce bugs
- Test coverage (30 pts max): Untested or under-tested code is inherently riskier
- Author count (15 pts max): "Too many cooks" — high author count correlates with merge conflicts
- Critical path (15 pts): Auth, payment, and core logic files get an automatic bonus

A file is flagged as a hotspot if its score exceeds 60.
"""

from loguru import logger


def compute_hotspot_score(file_data: dict) -> dict:
    """
    Compute a hotspot score for a single file.

    Args:
        file_data: Dictionary with file metadata:
            - file_path (str): Path to the file
            - churn_count (int): Number of modifications in last 30 days
            - has_tests (bool): Whether the file has associated tests
            - test_coverage_percent (float|None): 0-100, can be None
            - authors_count (int): Number of unique contributors
            - is_critical_path (bool): Whether file is in auth/payment/core
            - last_modified_days_ago (int): Days since last modification
            - complexity_score (float): 0-100, cyclomatic/cognitive complexity estimate

    Returns:
        {
            "file_path": str,
            "hotspot_score": float (0-100),
            "is_hotspot": bool (score > 60),
            "reasons": list of str,
            "breakdown": dict with individual component scores
        }
    """
    file_path = file_data.get("file_path", "unknown")
    churn_count = file_data.get("churn_count", 0)
    has_tests = file_data.get("has_tests", True)
    test_coverage_percent = file_data.get("test_coverage_percent", None)
    authors_count = file_data.get("authors_count", 1)
    is_critical_path = file_data.get("is_critical_path", False)
    last_modified_days_ago = file_data.get("last_modified_days_ago", 0)
    complexity_score = file_data.get("complexity_score", 0.0)

    reasons = []

    # ── Churn Score (max 30 points) ────────────────────────
    # Files modified frequently in the last 30 days are fragile
    churn_score = min(churn_count / 20 * 30, 30)
    if churn_score > 15:
        reasons.append(
            f"High churn: modified {churn_count} times in last 30 days"
        )

    # ── Test Penalty (max 25 points) ───────────────────────
    # No tests = 25 points. Low coverage = proportional penalty
    if not has_tests:
        test_penalty = 25
        reasons.append("No tests found for this file")
    elif test_coverage_percent is not None:
        test_penalty = max(0, (80 - test_coverage_percent) / 80 * 25)
        if test_coverage_percent < 50:
            reasons.append(
                f"Low test coverage: {test_coverage_percent:.0f}% (target: 80%)"
            )
    else:
        # Tests exist but coverage unknown — give partial penalty
        test_penalty = 8

    # ── Complexity Score (max 20 points) ───────────────────
    # More complex files represent a higher risk for changes
    complexity_contrib = min(complexity_score / 100 * 20, 20)
    if complexity_score >= 60:
        reasons.append(
            f"High complexity: file complexity index is {complexity_score:.0f}/100"
        )

    # ── Authors Score (max 10 points) ──────────────────────
    # Too many different people touching a file = coordination risk
    authors_score = min(authors_count / 5 * 10, 10)
    if authors_count >= 4:
        reasons.append(
            f"Many authors: {authors_count} contributors — coordination risk"
        )

    # ── Critical Path Bonus (15 points) ────────────────────
    # Auth, payment, core logic files are inherently higher risk
    critical_bonus = 15 if is_critical_path else 0
    if is_critical_path:
        reasons.append("Critical path file (auth/payment/core logic)")

    # ── Recency factor ─────────────────────────────────────
    # Recently modified files with high churn are more concerning
    if last_modified_days_ago <= 3 and churn_count > 10:
        reasons.append("Actively being modified with high churn")

    # ── Compute total ──────────────────────────────────────
    hotspot_score = churn_score + test_penalty + complexity_contrib + authors_score + critical_bonus
    hotspot_score = round(min(hotspot_score, 100), 2)

    is_hotspot = hotspot_score > 60

    return {
        "file_path": file_path,
        "hotspot_score": hotspot_score,
        "is_hotspot": is_hotspot,
        "reasons": reasons,
        "complexity_score": complexity_score,
        "breakdown": {
            "churn_score": round(churn_score, 2),
            "test_penalty": round(test_penalty, 2),
            "complexity_score": round(complexity_contrib, 2),
            "authors_score": round(authors_score, 2),
            "critical_bonus": critical_bonus,
        },
    }


def rank_hotspots(files: list) -> list:
    """
    Analyze and rank multiple files by hotspot score.

    Args:
        files: List of file data dictionaries (same format as compute_hotspot_score input).

    Returns:
        List of hotspot results sorted by hotspot_score descending.
    """
    if not files:
        return []

    results = []
    for file_data in files:
        try:
            result = compute_hotspot_score(file_data)
            results.append(result)
        except Exception as e:
            logger.warning(
                f"Failed to analyze file {file_data.get('file_path', '?')}: {e}"
            )

    # Sort by hotspot_score descending
    results.sort(key=lambda x: x["hotspot_score"], reverse=True)

    # Add rank
    for i, result in enumerate(results):
        result["rank"] = i + 1

    hotspot_count = sum(1 for r in results if r["is_hotspot"])
    logger.info(
        f"Analyzed {len(results)} files — {hotspot_count} flagged as hotspots"
    )

    return results
