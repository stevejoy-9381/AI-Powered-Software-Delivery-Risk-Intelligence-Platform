# 🚀 AI-Powered Software Delivery Risk Intelligence Platform

An intelligent platform that analyzes real engineering signals (GitHub data, Jira-style project data, commit messages, PR patterns) and uses ML + NLP to predict delivery risks before they happen.

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

## ✨ Core Features

| Feature | Description |
|---------|-------------|
| **Sprint Delay Prediction** | ML model predicts if a sprint will be delayed before it happens |
| **Risk Explanation** | Plain-English explanations of WHY a sprint is at risk |
| **Codebase Hotspots** | Identifies fragile files with high churn + low test coverage |
| **PR Summarization** | LLM-powered PR summaries with risk flag detection |
| **Team Benchmarking** | Compare delivery health metrics across teams |
| **Staffing Predictions** | Predict bottlenecks and recommend staffing actions |

## 🛠️ Tech Stack

- **Frontend:** React + TypeScript + Vite + Tailwind CSS + Recharts
- **Backend:** Node.js + Express.js
- **ML Service:** Python + FastAPI + scikit-learn + XGBoost
- **Databases:** MongoDB (project data) + PostgreSQL (ML feature store)
- **Auth:** JWT + GitHub OAuth
- **Containerization:** Docker + Docker Compose

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
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:5000/api
- **ML Service:** http://localhost:8000/docs
- **MongoDB:** localhost:27017
- **PostgreSQL:** localhost:5432

## 📁 Project Structure

```
delivery-risk-platform/
├── frontend/          → React + TypeScript dashboard
├── backend/           → Node.js + Express API server
├── ml-service/        → Python + FastAPI ML microservice
├── database/          → DB init scripts and schemas
├── docker-compose.yml → Orchestration for all services
└── README.md
```

## 🔑 Environment Variables

See `.env.example` for all required configuration.

## 📄 License

MIT
