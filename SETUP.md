# Setup Guide — DeliveryRisk AI

This guide contains detailed setup and environment configuration instructions to get the Delivery Risk Intelligence Platform running locally.

---

## 🔑 Environment Variables (.env)

The root `.env` file configures all components. Create a copy of `.env.example` as `.env` and configure:

```ini
# ── Database Connection Strings ──────────────────────────────
MONGO_URI=mongodb://localhost:27017/delivery_risk_db
POSTGRES_URI=postgresql://drp_user:drp_secret_2024@localhost:5432/ml_feature_store
POSTGRES_USER=drp_user
POSTGRES_PASSWORD=drp_secret_2024
POSTGRES_DB=ml_feature_store

# ── Authentication ───────────────────────────────────────────
JWT_SECRET=dev_jwt_secret_key_change_in_production_2024

# ── GitHub OAuth Integration ────────────────────────────────
# Get these from GitHub Developer Settings -> OAuth Apps
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_CALLBACK_URL=http://localhost:5000/api/auth/github/callback

# ── Machine Learning Service ─────────────────────────────────
ML_SERVICE_URL=http://localhost:8000
GROQ_API_KEY=your_groq_llm_api_key

# ── General ──────────────────────────────────────────────────
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:3000
```

---

## 🛠️ Step-by-Step Local Launch

### 1. Database Servers

You will need running instances of MongoDB and PostgreSQL.

If using Docker:
```bash
docker-compose up -d mongodb postgres
```

### 2. Python ML Microservice

1. Navigate to the ML service directory:
   ```bash
   cd ml-service
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the service:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```
   *Verify docs at: `http://localhost:8000/docs`*

### 3. Node.js Backend API

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install packages:
   ```bash
   npm install
   ```
3. Seed the database with realistic synthetic team metrics:
   ```bash
   npm run seed
   ```
4. Start the backend developer server:
   ```bash
   npm run dev
   ```
   *Verify health endpoint at: `http://localhost:5000/api/health`*

### 4. React Frontend Dashboard

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install packages:
   ```bash
   npm install
   ```
3. Launch Vite developer server:
   ```bash
   npm run dev
   ```
   *Launch browser at: `http://localhost:3000`*

---

## 🧪 Running Tests

To run the backend integration and route test suites:
```bash
cd backend
npm test
```
This runs Jest unit and integration tests under `backend/tests/` with coverage details.
