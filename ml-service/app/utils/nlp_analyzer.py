"""
NLP Analyzer Module
Handles all text analysis for the delivery risk platform:
- Sentiment scoring of commit messages and ticket titles
- Scope creep detection via semantic similarity
- Commit risk classification via keyword/pattern matching

Uses sentence-transformers (all-MiniLM-L6-v2) for embeddings.
The model is loaded ONCE at module level to avoid per-request overhead.
"""

import re
import numpy as np
from typing import Optional
from loguru import logger

# ── Lazy-load sentence-transformers to avoid import cost at startup ──
_sentence_model = None


def _get_sentence_model():
    """
    Lazy-load the SentenceTransformer model on first use.
    This avoids the ~2s import cost if NLP features aren't needed.
    """
    global _sentence_model
    if _sentence_model is None:
        try:
            from sentence_transformers import SentenceTransformer
            logger.info("Loading SentenceTransformer model: all-MiniLM-L6-v2...")
            _sentence_model = SentenceTransformer("all-MiniLM-L6-v2")
            logger.info("✅ SentenceTransformer model loaded")
        except Exception as e:
            logger.warning(f"⚠️ Could not load SentenceTransformer: {e}")
            logger.warning("Falling back to keyword-only analysis")
            _sentence_model = None
    return _sentence_model


_embedding_cache = {}


def _get_embeddings(texts: list) -> np.ndarray:
    """
    Get embeddings for a list of texts.
    Uses an in-memory cache to avoid recomputing embeddings for the same text.
    """
    model = _get_sentence_model()
    if model is None:
        raise ValueError("SentenceTransformer model is not available")

    embeddings = []
    texts_to_encode = []
    to_encode_indices = []

    for idx, text in enumerate(texts):
        key = text.strip() if text else ""
        if key in _embedding_cache:
            embeddings.append((idx, _embedding_cache[key]))
        else:
            texts_to_encode.append(text)
            to_encode_indices.append(idx)

    if texts_to_encode:
        new_embeddings = model.encode(texts_to_encode)
        for idx, text, emb in zip(to_encode_indices, texts_to_encode, new_embeddings):
            key = text.strip() if text else ""
            _embedding_cache[key] = emb
            embeddings.append((idx, emb))

    embeddings.sort(key=lambda x: x[0])
    return np.array([emb for _, emb in embeddings])


# ═══════════════════════════════════════════════════════════
# KEYWORD DICTIONARIES
# ═══════════════════════════════════════════════════════════

NEGATIVE_KEYWORDS = [
    "blocked", "stuck", "revert", "hotfix", "emergency",
    "rollback", "broken", "critical bug", "delayed", "cannot merge",
    "conflict", "failing", "failed", "regression", "urgent",
    "workaround", "hack", "temporary fix", "deadline missed",
    "out of scope", "dependency blocked", "cannot deploy",
]

POSITIVE_KEYWORDS = [
    "done", "merged", "complete", "shipped", "deployed", "fixed",
    "resolved", "implemented", "finished", "released", "approved",
    "all tests pass", "ready for review", "refactored", "optimized",
    "cleaned up", "documentation added", "tests added",
]

HIGH_RISK_KEYWORDS = [
    "security", "auth", "password", "token", "credentials",
    "payment", "database migration", "breaking change", "remove",
    "delete", "drop table", "alter table", "permissions",
    "encryption", "ssl", "certificate", "api key", "secret",
    "vulnerability", "injection", "xss", "csrf",
]

EMERGENCY_KEYWORDS = [
    "hotfix", "emergency", "rollback", "revert", "critical",
    "production down", "outage", "incident", "p0", "sev1",
    "urgent fix", "emergency deploy",
]


# ═══════════════════════════════════════════════════════════
# SENTIMENT ANALYSIS
# ═══════════════════════════════════════════════════════════

def compute_sentiment_score(texts: list) -> float:
    """
    Compute a sentiment score from commit messages or ticket titles.

    Uses a hybrid approach:
    1. Keyword matching for domain-specific signals
    2. Semantic analysis via sentence-transformers (if available)

    Args:
        texts: List of commit messages, ticket titles, or descriptions.

    Returns:
        Score from -1.0 (very negative/risky) to +1.0 (very positive/healthy).
    """
    if not texts:
        return 0.0

    # ── Keyword-based scoring ─────────────────────────────
    negative_count = 0
    positive_count = 0

    for text in texts:
        text_lower = text.lower() if text else ""

        for keyword in NEGATIVE_KEYWORDS:
            if keyword in text_lower:
                negative_count += 1
                break  # Count each text only once for negative

        for keyword in POSITIVE_KEYWORDS:
            if keyword in text_lower:
                positive_count += 1
                break  # Count each text only once for positive

    total = len(texts)
    # Keyword sentiment: ratio of positive vs negative signals
    keyword_score = (positive_count - negative_count) / max(total, 1)
    # Clamp to [-1, 1]
    keyword_score = max(-1.0, min(1.0, keyword_score))

    # ── Semantic scoring (if model available) ─────────────
    model = _get_sentence_model()
    if model is not None:
        try:
            # Define reference sentences for positive and negative delivery sentiment
            positive_ref = "Task completed successfully, all tests passing, ready for deployment"
            negative_ref = "Blocked by critical bug, reverting changes, production incident"

            # Get embeddings
            text_embeddings = _get_embeddings(texts[:50])  # Cap at 50 to limit compute
            pos_embedding = _get_embeddings([positive_ref])[0]
            neg_embedding = _get_embeddings([negative_ref])[0]

            # Compute average cosine similarity to positive vs negative
            avg_embedding = np.mean(text_embeddings, axis=0)

            pos_sim = float(np.dot(avg_embedding, pos_embedding) / (
                np.linalg.norm(avg_embedding) * np.linalg.norm(pos_embedding) + 1e-8
            ))
            neg_sim = float(np.dot(avg_embedding, neg_embedding) / (
                np.linalg.norm(avg_embedding) * np.linalg.norm(neg_embedding) + 1e-8
            ))

            # Semantic score: difference in similarity (positive - negative)
            semantic_score = (pos_sim - neg_sim) * 2  # Scale up for impact
            semantic_score = max(-1.0, min(1.0, semantic_score))

            # Combine: 60% keyword, 40% semantic
            final_score = 0.6 * keyword_score + 0.4 * semantic_score
        except Exception as e:
            logger.warning(f"Semantic analysis failed: {e}, using keyword-only")
            final_score = keyword_score
    else:
        final_score = keyword_score

    return round(float(final_score), 4)


# ═══════════════════════════════════════════════════════════
# SCOPE CREEP DETECTION
# ═══════════════════════════════════════════════════════════

def detect_scope_creep_from_text(
    ticket_descriptions: list,
    sprint_goal: str = "",
    threshold: float = 0.4,
) -> dict:
    """
    Detect scope creep by comparing ticket descriptions to the sprint goal.

    Uses semantic similarity: tickets with low similarity to the sprint goal
    are flagged as potential scope creep.

    Args:
        ticket_descriptions: List of ticket descriptions/titles.
        sprint_goal: The original sprint goal or theme.
        threshold: Cosine similarity threshold below which = scope creep.

    Returns:
        {
            "scope_creep_detected": bool,
            "flagged_tickets": list of indices,
            "severity": float (0-1, higher = more creep),
            "avg_similarity": float
        }
    """
    if not ticket_descriptions:
        return {
            "scope_creep_detected": False,
            "flagged_tickets": [],
            "severity": 0.0,
            "avg_similarity": 1.0,
        }

    model = _get_sentence_model()

    if model is None or not sprint_goal:
        # Fallback: use keyword heuristic
        creep_keywords = ["out of scope", "unplanned", "ad hoc", "added late", "not in sprint"]
        flagged = []
        for i, desc in enumerate(ticket_descriptions):
            if desc and any(kw in desc.lower() for kw in creep_keywords):
                flagged.append(i)

        severity = len(flagged) / max(len(ticket_descriptions), 1)
        return {
            "scope_creep_detected": len(flagged) > 0,
            "flagged_tickets": flagged,
            "severity": round(severity, 4),
            "avg_similarity": 1.0 - severity,
        }

    try:
        # Encode sprint goal and all ticket descriptions
        goal_embedding = _get_embeddings([sprint_goal])[0]
        ticket_embeddings = _get_embeddings(ticket_descriptions)

        flagged = []
        similarities = []

        for i, ticket_emb in enumerate(ticket_embeddings):
            sim = float(np.dot(goal_embedding, ticket_emb) / (
                np.linalg.norm(goal_embedding) * np.linalg.norm(ticket_emb) + 1e-8
            ))
            similarities.append(sim)
            if sim < threshold:
                flagged.append(i)

        avg_similarity = float(np.mean(similarities)) if similarities else 1.0
        severity = len(flagged) / max(len(ticket_descriptions), 1)

        return {
            "scope_creep_detected": len(flagged) > 0,
            "flagged_tickets": flagged,
            "severity": round(severity, 4),
            "avg_similarity": round(avg_similarity, 4),
        }
    except Exception as e:
        logger.warning(f"Scope creep detection failed: {e}")
        return {
            "scope_creep_detected": False,
            "flagged_tickets": [],
            "severity": 0.0,
            "avg_similarity": 1.0,
        }


# ═══════════════════════════════════════════════════════════
# COMMIT RISK CLASSIFICATION
# ═══════════════════════════════════════════════════════════

def classify_commit_risk(commit_messages: list) -> dict:
    """
    Classify commit messages by risk level using regex + keyword matching.

    Args:
        commit_messages: List of commit message strings.

    Returns:
        {
            "high_risk_commits": int,
            "emergency_commits": int,
            "risk_level": "low" | "medium" | "high",
            "flagged_messages": list of flagged message strings
        }
    """
    if not commit_messages:
        return {
            "high_risk_commits": 0,
            "emergency_commits": 0,
            "risk_level": "low",
            "flagged_messages": [],
        }

    high_risk_count = 0
    emergency_count = 0
    flagged_messages = []

    for msg in commit_messages:
        if not msg:
            continue
        msg_lower = msg.lower()

        # Check for high-risk patterns
        is_high_risk = any(kw in msg_lower for kw in HIGH_RISK_KEYWORDS)

        # Check for emergency patterns
        is_emergency = any(kw in msg_lower for kw in EMERGENCY_KEYWORDS)

        # Additional regex patterns for risky commits
        risky_patterns = [
            r"rm\s+-rf",         # Dangerous file deletion
            r"drop\s+table",     # Database drops
            r"force\s+push",     # Force pushes
            r"disable.*test",    # Disabling tests
            r"skip.*ci",         # Skipping CI
            r"todo.*hack",       # Acknowledged hacks
        ]
        is_pattern_match = any(
            re.search(pattern, msg_lower) for pattern in risky_patterns
        )

        if is_emergency:
            emergency_count += 1
            flagged_messages.append(msg)
        elif is_high_risk or is_pattern_match:
            high_risk_count += 1
            flagged_messages.append(msg)

    # Determine overall risk level
    total = len(commit_messages)
    risk_ratio = (high_risk_count + emergency_count * 2) / max(total, 1)

    if emergency_count >= 2 or risk_ratio > 0.3:
        risk_level = "high"
    elif high_risk_count >= 2 or risk_ratio > 0.15:
        risk_level = "medium"
    else:
        risk_level = "low"

    return {
        "high_risk_commits": high_risk_count,
        "emergency_commits": emergency_count,
        "risk_level": risk_level,
        "flagged_messages": flagged_messages[:10],  # Cap at 10
    }
