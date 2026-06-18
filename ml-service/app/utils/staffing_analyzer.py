"""
Staffing Signal Analyzer Module
Analyzes sprint data to predict staffing bottlenecks and provide
actionable recommendations.

Detects three categories of staffing issues:
1. Reviewer bottleneck — PRs sitting idle due to insufficient reviewers
2. Backend/frontend imbalance — workload skewed but team isn't
3. Bus factor risk — knowledge concentrated in one person
"""

from loguru import logger


# File extensions for classifying backend vs frontend work
BACKEND_EXTENSIONS = {".py", ".java", ".go", ".rs", ".rb", ".cs", ".scala", ".kt"}
FRONTEND_EXTENSIONS = {".tsx", ".jsx", ".css", ".scss", ".less", ".html", ".vue", ".svelte"}


def analyze_staffing_signals(sprint_data: dict, team_history: list = None) -> dict:
    """
    Analyze sprint data to detect staffing bottlenecks.

    Args:
        sprint_data: Dictionary containing current sprint information:
            - team_size (int): Number of developers on the team
            - senior_dev_count (int): Number of senior developers
            - open_prs (int): Currently open pull requests
            - open_tickets (int): Currently open/in-progress tickets
            - avg_pr_review_lag_hours (float): Average PR review time in hours
            - changed_files (list[str]): File paths changed in this sprint
            - commits (list[dict]): Commit objects with "author" field
            - backend_dev_count (int, optional): Number of backend developers
            - frontend_dev_count (int, optional): Number of frontend developers

        team_history: List of previous sprint dictionaries with:
            - commits (list[dict]): Each with "author" field
            - sprint_number (int)

    Returns:
        {
            "bottlenecks": list of detected bottleneck objects,
            "staffing_recommendation": str (plain English),
            "estimated_impact": str,
            "bus_factor_risk": bool,
            "critical_person": str or None
        }
    """
    team_history = team_history or []

    team_size = sprint_data.get("team_size", 1) or 1
    senior_dev_count = sprint_data.get("senior_dev_count", 0)
    open_prs = sprint_data.get("open_prs", 0)
    open_tickets = sprint_data.get("open_tickets", 0)
    avg_pr_review_lag_hours = sprint_data.get("avg_pr_review_lag_hours", 0)
    changed_files = sprint_data.get("changed_files", [])
    commits = sprint_data.get("commits", [])

    bottlenecks = []
    recommendations = []

    # ── 1. Workload per developer ──────────────────────────
    active_prs_per_dev = open_prs / team_size
    tickets_per_dev = open_tickets / team_size

    if active_prs_per_dev > 3:
        bottlenecks.append({
            "type": "workload_overload",
            "severity": "high",
            "metric": f"{active_prs_per_dev:.1f} open PRs per developer",
            "description": (
                f"Each developer has ~{active_prs_per_dev:.1f} open PRs — "
                f"context switching is likely reducing productivity"
            ),
        })
        recommendations.append(
            "Consider limiting WIP (work-in-progress) to 2 PRs per developer"
        )

    if tickets_per_dev > 5:
        bottlenecks.append({
            "type": "ticket_overload",
            "severity": "medium",
            "metric": f"{tickets_per_dev:.1f} tickets per developer",
            "description": (
                f"Each developer is juggling ~{tickets_per_dev:.1f} tickets — "
                f"focus may be spread too thin"
            ),
        })

    # ── 2. Reviewer bottleneck ─────────────────────────────
    if avg_pr_review_lag_hours > 24 and senior_dev_count < 3:
        severity = "high" if avg_pr_review_lag_hours > 48 else "medium"
        estimated_improvement = min(40, int(avg_pr_review_lag_hours / 24 * 15))

        bottlenecks.append({
            "type": "reviewer_bottleneck",
            "severity": severity,
            "metric": f"{avg_pr_review_lag_hours:.0f}h avg review lag",
            "description": (
                f"Average PR review lag is {avg_pr_review_lag_hours:.0f} hours "
                f"with only {senior_dev_count} senior dev(s) — "
                f"reviews are blocking merges"
            ),
        })
        recommendations.append(
            f"Add 1 senior reviewer to reduce PR lag by estimated {estimated_improvement}%"
        )

    # ── 3. Backend/frontend bottleneck ─────────────────────
    if changed_files:
        backend_files = sum(
            1 for f in changed_files
            if any(f.lower().endswith(ext) for ext in BACKEND_EXTENSIONS)
        )
        frontend_files = sum(
            1 for f in changed_files
            if any(f.lower().endswith(ext) for ext in FRONTEND_EXTENSIONS)
        )
        total_classified = backend_files + frontend_files

        if total_classified > 0:
            backend_ratio = backend_files / total_classified
            frontend_ratio = frontend_files / total_classified

            backend_dev_count = sprint_data.get("backend_dev_count", 0)
            frontend_dev_count = sprint_data.get("frontend_dev_count", 0)

            # Detect backend bottleneck
            if backend_ratio > 0.7 and backend_dev_count > 0:
                backend_team_ratio = backend_dev_count / team_size
                if backend_team_ratio < 0.3:
                    bottlenecks.append({
                        "type": "backend_bottleneck",
                        "severity": "medium",
                        "metric": (
                            f"{backend_ratio:.0%} backend changes, "
                            f"{backend_dev_count} backend devs ({backend_team_ratio:.0%} of team)"
                        ),
                        "description": (
                            f"{backend_ratio:.0%} of changes are backend but only "
                            f"{backend_team_ratio:.0%} of team are backend developers"
                        ),
                    })
                    recommendations.append(
                        "Backend workload is disproportionate — consider cross-training or adding backend capacity"
                    )

            # Detect frontend bottleneck
            if frontend_ratio > 0.7 and frontend_dev_count > 0:
                frontend_team_ratio = frontend_dev_count / team_size
                if frontend_team_ratio < 0.3:
                    bottlenecks.append({
                        "type": "frontend_bottleneck",
                        "severity": "medium",
                        "metric": (
                            f"{frontend_ratio:.0%} frontend changes, "
                            f"{frontend_dev_count} frontend devs ({frontend_team_ratio:.0%} of team)"
                        ),
                        "description": (
                            f"{frontend_ratio:.0%} of changes are frontend but only "
                            f"{frontend_team_ratio:.0%} of team are frontend developers"
                        ),
                    })
                    recommendations.append(
                        "Frontend workload is disproportionate — consider cross-training or adding frontend capacity"
                    )

    # ── 4. Bus factor risk ─────────────────────────────────
    bus_factor_risk = False
    critical_person = None

    # Analyze commits from current sprint + last 2 sprints
    all_commits = list(commits)
    recent_history = team_history[-2:] if len(team_history) >= 2 else team_history
    for past_sprint in recent_history:
        all_commits.extend(past_sprint.get("commits", []))

    if all_commits:
        # Count commits per author
        author_commits = {}
        for commit in all_commits:
            author = commit.get("author", "unknown")
            author_commits[author] = author_commits.get(author, 0) + 1

        total_commits = sum(author_commits.values())

        if total_commits > 0 and author_commits:
            # Find the top contributor
            top_author = max(author_commits, key=author_commits.get)
            top_author_ratio = author_commits[top_author] / total_commits

            if top_author_ratio > 0.4:
                bus_factor_risk = True
                critical_person = top_author
                pct = top_author_ratio * 100

                bottlenecks.append({
                    "type": "bus_factor",
                    "severity": "high" if top_author_ratio > 0.6 else "medium",
                    "metric": f"{pct:.0f}% of commits by {top_author}",
                    "description": (
                        f"{pct:.0f}% of commits in the last 2 sprints came from "
                        f"{top_author} — knowledge is concentrated in one person"
                    ),
                })
                recommendations.append(
                    f"Knowledge concentrated in {top_author} — pair programming recommended"
                )

    # ── 5. Knowledge Silo Check ────────────────────────────
    components = {
        "auth": ["auth", "login", "password", "token", "permission", "jwt", "session"],
        "payment": ["payment", "billing", "stripe", "checkout", "invoice"],
        "database": ["db", "database", "postgres", "mongo", "migration", "sql", "schema"],
        "ci_cd": ["ci", "cd", "docker", "compose", "pipeline", "workflow", "actions", "deploy"],
    }
    
    component_authors = {comp: {} for comp in components}
    for commit in all_commits:
        msg = commit.get("message", "").lower() if commit.get("message") else ""
        author = commit.get("author", "unknown")
        for comp, keywords in components.items():
            if any(kw in msg for kw in keywords):
                component_authors[comp][author] = component_authors[comp].get(author, 0) + 1

    for comp, authors in component_authors.items():
        total_comp_commits = sum(authors.values())
        if total_comp_commits >= 3:
            if len(authors) == 1:
                sole_author = list(authors.keys())[0]
                bottlenecks.append({
                    "type": "knowledge_silo",
                    "severity": "medium",
                    "metric": f"Single owner for {comp} component",
                    "description": (
                        f"Only {sole_author} has committed to the '{comp}' component "
                        f"({total_comp_commits} commits) in recent sprints. "
                        f"This creates a knowledge silo."
                    ),
                })
                recommendations.append(
                    f"Cross-train other developers on the '{comp}' component currently owned solely by {sole_author}"
                )

    # ── 6. Availability Risk / Recent Drop-off Check ────────
    author_sprint_counts = {}
    for idx, past_sprint in enumerate(team_history):
        sprint_commits = past_sprint.get("commits", [])
        counts_this_sprint = {}
        for c in sprint_commits:
            author = c.get("author", "unknown")
            counts_this_sprint[author] = counts_this_sprint.get(author, 0) + 1
        
        for author, count in counts_this_sprint.items():
            if author not in author_sprint_counts:
                author_sprint_counts[author] = [0] * len(team_history)
            author_sprint_counts[author][idx] = count
            
    current_counts = {}
    for c in commits:
        author = c.get("author", "unknown")
        current_counts[author] = current_counts.get(author, 0) + 1
        
    for author, counts in author_sprint_counts.items():
        current_count = current_counts.get(author, 0)
        if len(counts) >= 1:
            historical_mean = sum(counts) / len(counts)
            if historical_mean >= 3:
                import math
                variance = sum((x - historical_mean) ** 2 for x in counts) / len(counts)
                std_dev = math.sqrt(variance)
                
                if std_dev > 0:
                    z_score = (current_count - historical_mean) / std_dev
                else:
                    z_score = (current_count - historical_mean) / 1.0
                
                if z_score < -1.5 or (current_count <= 1 and historical_mean >= 5):
                    bottlenecks.append({
                        "type": "availability_risk",
                        "severity": "high" if current_count == 0 else "medium",
                        "metric": f"{author} commit drop-off (curr: {current_count}, avg: {historical_mean:.1f})",
                        "description": (
                            f"Commit activity for {author} dropped significantly this sprint "
                            f"(current: {current_count} commits vs historical average of {historical_mean:.1f}). "
                            f"This indicates potential unavailability."
                        ),
                    })
                    recommendations.append(
                        f"Check availability of {author} and reallocate critical tasks if necessary"
                    )

    # ── Build final recommendation ─────────────────────────
    if not recommendations:
        staffing_recommendation = "Team staffing appears balanced — no immediate action needed"
        estimated_impact = "Current team composition is adequate for the workload"
    elif len(recommendations) == 1:
        staffing_recommendation = recommendations[0]
        estimated_impact = _estimate_impact(bottlenecks)
    else:
        staffing_recommendation = "; ".join(recommendations)
        estimated_impact = _estimate_impact(bottlenecks)

    return {
        "bottlenecks": bottlenecks,
        "staffing_recommendation": staffing_recommendation,
        "estimated_impact": estimated_impact,
        "bus_factor_risk": bus_factor_risk,
        "critical_person": critical_person,
        "metrics": {
            "active_prs_per_dev": round(active_prs_per_dev, 2),
            "tickets_per_dev": round(tickets_per_dev, 2),
            "avg_pr_review_lag_hours": avg_pr_review_lag_hours,
            "team_size": team_size,
            "senior_dev_count": senior_dev_count,
        },
    }


def _estimate_impact(bottlenecks: list) -> str:
    """Generate an impact estimate based on detected bottlenecks."""
    if not bottlenecks:
        return "No significant staffing issues detected"

    impacts = []
    for bn in bottlenecks:
        bn_type = bn.get("type", "")
        if bn_type == "reviewer_bottleneck":
            impacts.append("Adding 1 reviewer could reduce delay probability by 35%")
        elif bn_type == "bus_factor":
            impacts.append("Pair programming could reduce bus factor risk by 50%")
        elif bn_type == "workload_overload":
            impacts.append("Reducing WIP could improve throughput by 20-30%")
        elif bn_type in ("backend_bottleneck", "frontend_bottleneck"):
            impacts.append("Rebalancing team could improve velocity by 15-25%")
        elif bn_type == "knowledge_silo":
            impacts.append("Cross-training could mitigate single-point-of-failure risk")
        elif bn_type == "availability_risk":
            impacts.append("Reallocating tasks could prevent sprint delays from contributor absence")

    return "; ".join(impacts) if impacts else "Addressing bottlenecks could improve delivery predictability"
