# 🚀 AI-Powered Software Delivery Risk Intelligence Platform

An intelligent platform that analyzes real engineering signals (GitHub data, Jira-style project data, commit messages, PR patterns) and uses ML + NLP to predict delivery risks before they happen.

---

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   React + Vite   │────▶│  Node.js + Express│────▶│ Python + FastAPI │
│   (Frontend)     │     │    (Backend API)  │     │  (ML Service)   │
│   Port 3000      │     │    Port 5000      │     │  Port 8000      │
└─────────────────┘     └────────┬──────────┘     └─────────────────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼                         ▼
             ┌──────────┐              ┌──────────┐
             │ MongoDB   │              │PostgreSQL │
             │ Port 27017│              │ Port 5432 │
             └──────────┘              └──────────┘
```

---

## 🧠 ML Models & Analysis Pipelines

DeliveryRisk AI leverages a suite of machine learning models and analytical processors trained on historical sprint engineering metrics:

### 1. Sprint Delay Risk Classifier
- **Models**: XGBoost (`risk_model.pkl`) & LightGBM (`lgbm_risk_model.pkl`)
- **Input Features**:
  - `commit_frequency` (average commits per day)
  - `commit_frequency_change` (% change vs previous sprint)
  - `pr_cycle_time_avg_hours` (PR open-to-merge time)
  - `pr_review_lag_avg_hours` (PR open-to-first-review time)
  - `code_churn_rate` (ratio of changed lines vs total lines)
  - `tickets_added_mid_sprint` (scope creep indicator)
  - `scope_creep_detected` (Boolean indicating mid-sprint points added > 20%)
  - `blocked_tickets_count` (active blockers)
  - `sentiment_score` (NLP analysis of commit/ticket text)
  - `team_size` and `planned_points`
- **Hybrid Score Weighting**: Evaluates to a composite score: **40% rule-based heuristics + 60% ML classifier prediction probability**.
- **Metrics**: Reaches ~89% prediction accuracy and an F1-score of ~87% in test validation.

### 2. Release Readiness Predictor
- **Model**: LightGBM (`lgbm_release_model.pkl`)
- **Input Features**:
  - `sprint_risk_score` (the current active sprint risk)
  - `hotspot_count` (flagged fragile codebase files)
  - `critical_pr_count` (open PRs touching critical auth/payment paths)
  - `days_remaining`
- **Hybrid Weighting**: **60% ML prediction + 40% rule-based deductions** (falls back gracefully to rule-based deductions if the ML service is unreachable).

### 3. LLM PR Summarizer & Sprint Pattern Detector
- **Technology**: Groq LLM API with `sentence-transformers` for embeddings.
- **Features**: Generates natural language summaries of pull request additions, flags security and authorization changes, and runs cross-PR pattern checks to highlight concurrent file modifications or undocumented scope deviations.

---

## 🔌 API Endpoints Reference

### Backend API (`http://localhost:5000`)
- **Authentication**:
  - `POST /api/auth/register` - Register new developer accounts
  - `POST /api/auth/login` - Authenticate credentials and retrieve JWT
  - `GET /api/auth/me` - Profile overview of currently authenticated user
- **Sprints**:
  - `GET /api/sprints/:sprintId` - Load individual sprint detail, members, and PRs
  - `GET /api/sprints/team/:teamId` - Paginated fetch of recent sprints for a team (default 20, max 100)
  - `POST /api/sprints/:sprintId/analyze` - Run full ML delay prediction and save results to PostgreSQL
  - `POST /api/sprints/:sprintId/analyze-all-prs` - Trigger batch PR summarizes and cross-PR pattern analysis
  - `GET /api/sprints/:sprintId/risk-history` - Historical time-series of risk assessments for the sprint
- **Analytics & GitHub Integration**:
  - `GET /api/analytics/dashboard/:orgId` - Distribution metrics for the command center
  - `GET /api/analytics/team/:teamId/benchmark` - Retrieve composite grade, category breakdown, and team recommendations
  - `GET /api/analytics/release-readiness/:projectId` - Composite release score (0-100), delay probability, and blockers list
  - `POST /api/github/sync/:projectId` - Fetch latest Git commits/PR changes (defaults to mock sync if no valid Token exists)
  - `GET /api/github/analyze-hotspots/:projectId` - Calculate churn, coverage, and rank hotspots

### ML Service (`http://localhost:8000`)
- **Core Operations**:
  - `POST /api/risk/score` - Run XGBoost/LightGBM prediction on a sprint feature vector
  - `POST /api/release/predict` - Compute release readiness grade and delay probability
  - `POST /api/pr/summarize` - Summarize single PR description and flag risk keywords
  - `POST /api/pr/summarize-batch` - Bulk analyze list of PRs
  - `POST /api/pr/detect-risk-pattern` - Summarize cross-PR patterns relative to the sprint goal
  - `POST /api/staffing/analyze` - Run bus-factor-1, reviewer overload, knowledge silo, and availability z-score drop-offs
  - `POST /api/benchmark/compute` - Return health score (0-100), letter grade, and categories breakdown

---

## ⚡ Future Improvements & Production Caching

The current caching design is optimized for developer velocity and zero-dependency local setup:
- **In-Memory Caches**: Keyed dictionaries are implemented inside `nlp_analyzer.py` (embedding cache) and `pr_summarizer.py` (Groq response cache).
- **Production Redis Migration**: In a production deployment, this in-memory strategy should be replaced with a dedicated **Redis** cluster:
  - *Trade-off*: In-memory cache is volatile, bound to a single worker process, and grows indefinitely in memory. Redis supports distributed processes, persistent caching, automated Key Expiry (TTL), and efficient memory usage via cache-eviction policies (e.g. Least Recently Used).
- **Webhook Integration**: Move from manual sync polling to GitHub push/PR Webhooks for real-time risk assessment updates.

---

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for local development)
- Python 3.11+ (for local ML development)

### 1. Clone and configure
```bash
cp .env.example .env
# Edit .env with your credentials
```

### 2. Start all services
```bash
docker-compose up --build
```

### 3. Seed the database
```bash
cd backend
npm run seed
```

### 4. Access the platform
- **Frontend Dashboard**: http://localhost:3000
- **Backend API**: http://localhost:5000/api
- **ML Service**: http://localhost:8000/docs

### 🔑 Demo Credentials
- **Username / Email**: `admin@demo.com`
- **Password**: `Demo@123`

---

## 📁 Project Structure

```
delivery-risk-platform/
├── frontend/          → React + TypeScript dashboard SPA
├── backend/           → Node.js + Express API server
├── ml-service/        → Python + FastAPI ML microservice
├── database/          → DB init scripts and Postgres schema config
├── docker-compose.yml → Orchestration for all containers
└── README.md
```

## 📄 License

MIT
