import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from app.utils.staffing_analyzer import analyze_staffing_signals
from app.utils.pr_summarizer import summarize_pr, clear_cache

# ═══════════════════════════════════════════════════════════
# 1. Staffing Analyzer Tests
# ═══════════════════════════════════════════════════════════

def test_reviewer_overload():
    # Reviewer overload: avg review lag >24h with <3 senior devs
    sprint_data = {
        "team_size": 4,
        "senior_dev_count": 2,
        "open_prs": 2,
        "open_tickets": 2,
        "avg_pr_review_lag_hours": 30.0,
        "changed_files": ["src/main.py"],
        "commits": [{"author": "dev-1"}]
    }
    result = analyze_staffing_signals(sprint_data)
    
    bottlenecks = [b for b in result["bottlenecks"] if b["type"] == "reviewer_bottleneck"]
    assert len(bottlenecks) == 1
    assert bottlenecks[0]["severity"] in ["medium", "high"]


def test_bus_factor():
    # Bus factor: single person doing >40% of commits
    sprint_data = {
        "team_size": 5,
        "senior_dev_count": 3,
        "open_prs": 1,
        "open_tickets": 1,
        "avg_pr_review_lag_hours": 5.0,
        "changed_files": [],
        "commits": [
            {"author": "john-doe"},
            {"author": "john-doe"},
            {"author": "john-doe"},
            {"author": "john-doe"},
            {"author": "dev-2"},
        ] # john-doe has 4/5 = 80% commits
    }
    result = analyze_staffing_signals(sprint_data)
    
    assert result["bus_factor_risk"] is True
    assert result["critical_person"] == "john-doe"
    
    bottlenecks = [b for b in result["bottlenecks"] if b["type"] == "bus_factor"]
    assert len(bottlenecks) == 1


def test_knowledge_silo():
    # Knowledge silo: auth component owned solely by dev-1
    sprint_data = {
        "team_size": 3,
        "senior_dev_count": 1,
        "open_prs": 1,
        "open_tickets": 1,
        "avg_pr_review_lag_hours": 5.0,
        "changed_files": [],
        "commits": [
            {"author": "dev-1", "message": "feat: implement JWT auth logins"},
            {"author": "dev-1", "message": "fix: update auth middleware"},
            {"author": "dev-1", "message": "test: add auth unit tests"},
        ]
    }
    result = analyze_staffing_signals(sprint_data)
    
    bottlenecks = [b for b in result["bottlenecks"] if b["type"] == "knowledge_silo"]
    assert len(bottlenecks) == 1
    assert "auth" in bottlenecks[0]["description"]


def test_availability_risk():
    # Availability risk: dev-1 historical avg is 6, drop-off to 0 commits
    sprint_data = {
        "team_size": 3,
        "senior_dev_count": 1,
        "open_prs": 1,
        "open_tickets": 1,
        "avg_pr_review_lag_hours": 5.0,
        "changed_files": [],
        "commits": [] # dev-1 has 0 commits
    }
    team_history = [
        {"commits": [{"author": "dev-1"}] * 6},
        {"commits": [{"author": "dev-1"}] * 6},
    ]
    result = analyze_staffing_signals(sprint_data, team_history=team_history)
    
    bottlenecks = [b for b in result["bottlenecks"] if b["type"] == "availability_risk"]
    assert len(bottlenecks) == 1


# ═══════════════════════════════════════════════════════════
# 2. PR Summarizer Caching and Heuristics Tests
# ═══════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_pr_summarizer_caching_and_fallback():
    clear_cache()
    
    pr_data = {
        "title": "feat: impl stripe checkout",
        "description": "this adds basic billing webhook support",
        "files_changed": ["src/billing.js", "src/payment.js"],
        "additions": 45,
        "deletions": 5,
        "has_tests": False,
        "githubPrNumber": 12,
    }
    
    # 1. Test fallback when GROQ_API_KEY is not set
    with patch.dict("os.environ", {"GROQ_API_KEY": ""}):
        res_fallback = await summarize_pr(pr_data)
        assert res_fallback["cached"] is False
        assert res_fallback["touches_payments"] is True
        assert "No tests included" in res_fallback["risk_flags"]

    # 2. Test caching with a successful mocked API call
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "choices": [{
            "message": {
                "content": '{"summary": "Stripe billing integration", "risk_level": "medium", "risk_flags": [], "touches_auth": false, "touches_payments": true, "scope_assessment": "on-scope", "reviewer_note": "check Stripe API version"}'
            }
        }]
    }

    mock_post = AsyncMock(return_value=mock_response)

    with patch.dict("os.environ", {"GROQ_API_KEY": "fake-key-for-testing"}), \
         patch("httpx.AsyncClient.post", mock_post):
        
        # First call: not cached, calls the mocked post
        res1 = await summarize_pr(pr_data)
        assert res1["cached"] is False
        assert res1["touches_payments"] is True
        
        # Second call: retrieved from cache, does not call post
        res2 = await summarize_pr(pr_data)
        assert res2["cached"] is True
        assert res2["touches_payments"] is True
