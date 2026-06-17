-- ============================================================
-- PostgreSQL Schema — ML Feature Store & Predictions
-- Delivery Risk Intelligence Platform
-- ============================================================

-- Enable UUID extension for potential future use
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ──────────────────────────────────────────────────────────────
-- Table 1: sprint_features
-- Extracted ML feature vectors for sprint delay prediction.
-- Each row = one sprint's worth of features for model input.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sprint_features (
    sprint_id               TEXT PRIMARY KEY,
    team_id                 TEXT NOT NULL,

    -- Commit activity signals
    commit_frequency        FLOAT DEFAULT 0,          -- avg commits per day this sprint
    commit_frequency_change FLOAT DEFAULT 0,          -- % change vs previous sprint

    -- PR cycle signals
    pr_cycle_time_avg_hours FLOAT DEFAULT 0,          -- avg time from PR open → merge
    pr_review_lag_avg_hours FLOAT DEFAULT 0,          -- avg time from PR open → first review
    pr_review_lag_change    FLOAT DEFAULT 0,          -- % change vs team historical avg

    -- Code quality signals
    code_churn_rate         FLOAT DEFAULT 0,          -- (additions + deletions) / total lines

    -- Ticket health signals
    tickets_reopened_count  INT DEFAULT 0,            -- tickets reopened during sprint
    tickets_added_mid_sprint INT DEFAULT 0,           -- scope creep: tickets added after start
    scope_creep_detected    BOOLEAN DEFAULT FALSE,    -- true if mid-sprint additions > 20% of planned

    -- Team capacity signals
    team_size               INT DEFAULT 0,
    planned_points          INT DEFAULT 0,
    days_remaining          INT DEFAULT 0,

    -- Velocity signals
    velocity_trend          FLOAT DEFAULT 0,          -- avg velocity over last 3 sprints

    -- Blocker signals
    blocked_tickets_count   INT DEFAULT 0,

    -- NLP-derived signals
    sentiment_score         FLOAT DEFAULT 0,          -- sentiment from commit messages / ticket text

    -- Prediction target
    risk_score              FLOAT DEFAULT 0,          -- computed risk score (0-100)
    was_delayed             BOOLEAN DEFAULT FALSE,    -- ground truth label for model training

    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for team-level queries and time-series analysis
CREATE INDEX IF NOT EXISTS idx_sprint_features_team ON sprint_features (team_id);
CREATE INDEX IF NOT EXISTS idx_sprint_features_delayed ON sprint_features (was_delayed);


-- ──────────────────────────────────────────────────────────────
-- Table 2: codebase_hotspots
-- Files with high churn + low test coverage = fragile code.
-- Computed by the hotspot analysis ML pipeline.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS codebase_hotspots (
    id                      SERIAL PRIMARY KEY,
    project_id              TEXT NOT NULL,
    file_path               TEXT NOT NULL,

    -- Churn metrics
    churn_count             INT DEFAULT 0,            -- # of changes in last 30 days
    last_modified           TIMESTAMP,

    -- Quality metrics
    has_tests               BOOLEAN DEFAULT FALSE,
    test_coverage_percent   FLOAT DEFAULT 0,          -- 0.0 to 100.0

    -- Ownership metrics
    authors_count           INT DEFAULT 1,            -- too many authors = risky (bus factor)

    -- Computed risk
    hotspot_score           FLOAT DEFAULT 0,          -- composite score (0-100)
    complexity_score        FLOAT DEFAULT 0,          -- cognitive/cyclomatic complexity estimate (0-100)
    flagged                 BOOLEAN DEFAULT FALSE,    -- true if above risk threshold

    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for project-level hotspot queries
CREATE INDEX IF NOT EXISTS idx_hotspots_project ON codebase_hotspots (project_id);
CREATE INDEX IF NOT EXISTS idx_hotspots_flagged ON codebase_hotspots (flagged) WHERE flagged = TRUE;
CREATE INDEX IF NOT EXISTS idx_hotspots_score ON codebase_hotspots (hotspot_score DESC);


-- ──────────────────────────────────────────────────────────────
-- Table 3: team_benchmarks
-- Periodic team performance metrics for cross-team comparison.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_benchmarks (
    id                          SERIAL PRIMARY KEY,
    team_id                     TEXT NOT NULL,
    organization_id             TEXT NOT NULL,
    period                      TEXT NOT NULL,             -- e.g. "2024-Q1", "2024-Q2"

    -- Delivery metrics
    avg_sprint_delay_days       FLOAT DEFAULT 0,
    on_time_delivery_rate       FLOAT DEFAULT 0,           -- 0.0 to 1.0
    sprints_completed           INT DEFAULT 0,

    -- Engineering metrics
    avg_pr_cycle_time_hours     FLOAT DEFAULT 0,
    avg_churn_rate              FLOAT DEFAULT 0,
    avg_code_review_turnaround  FLOAT DEFAULT 0,           -- hours

    -- Composite scores
    delivery_health_score       FLOAT DEFAULT 0,           -- 0-100 composite
    percentile_rank             FLOAT DEFAULT 0,           -- vs other teams in org (0-100)

    created_at                  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Prevent duplicate entries for same team+period
    UNIQUE (team_id, period)
);

CREATE INDEX IF NOT EXISTS idx_benchmarks_org ON team_benchmarks (organization_id);
CREATE INDEX IF NOT EXISTS idx_benchmarks_period ON team_benchmarks (period);


-- ──────────────────────────────────────────────────────────────
-- Table 4: risk_predictions
-- ML model outputs — stored predictions for audit trail & display.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS risk_predictions (
    id                          SERIAL PRIMARY KEY,
    sprint_id                   TEXT NOT NULL,

    -- Prediction results
    predicted_risk_score        FLOAT NOT NULL,            -- 0-100
    predicted_delay             BOOLEAN DEFAULT FALSE,
    confidence                  FLOAT DEFAULT 0,           -- 0.0 to 1.0

    -- Explainability
    risk_factors                JSONB DEFAULT '[]'::jsonb,
    -- Structure: [{"factor": "scope_creep", "severity": "high", "description": "..."}]

    -- Recommendations
    staffing_recommendation     TEXT DEFAULT '',

    -- Model metadata
    model_version               TEXT DEFAULT 'v1.0',

    created_at                  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_predictions_sprint ON risk_predictions (sprint_id);
CREATE INDEX IF NOT EXISTS idx_predictions_time ON risk_predictions (created_at DESC);


-- ──────────────────────────────────────────────────────────────
-- Table 5: staffing_predictions (bonus table for staffing feature)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staffing_predictions (
    id                          SERIAL PRIMARY KEY,
    team_id                     TEXT NOT NULL,
    organization_id             TEXT NOT NULL,

    -- Prediction
    current_capacity            INT DEFAULT 0,
    required_capacity           INT DEFAULT 0,
    predicted_shortage          INT DEFAULT 0,
    bottleneck_role             TEXT DEFAULT '',           -- e.g., "senior backend"
    timeframe                   TEXT DEFAULT '',           -- e.g., "next 2 sprints"
    confidence                  FLOAT DEFAULT 0,

    -- Recommendation
    recommendation              TEXT DEFAULT '',

    created_at                  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_staffing_team ON staffing_predictions (team_id);


-- ──────────────────────────────────────────────────────────────
-- Seed confirmation
-- ──────────────────────────────────────────────────────────────
DO $$
BEGIN
    RAISE NOTICE 'PostgreSQL schema initialized successfully for ML Feature Store.';
END $$;
