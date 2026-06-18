"""
ML Service Entry Point
FastAPI application for all ML/NLP operations:
- Sprint delay prediction
- Risk explanation generation
- Codebase hotspot analysis
- PR summarization
- Team benchmarking
- Staffing prediction
- Release readiness prediction
"""

import os
import time
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

# Load environment variables
load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Startup/shutdown lifecycle events.
    Load ML models into memory at startup, release at shutdown.
    """
    logger.info("🚀 Starting ML Service...")
    logger.info("📦 Loading ML models...")

    # ── Load ML models at startup ───────────────────────────
    try:
        from app.utils.model_trainer import load_model, load_release_model
        model = load_model()
        app.state.ml_model = model
        app.state.model_loaded = model is not None

        if model is not None:
            logger.info("✅ ML risk model loaded successfully")
        else:
            logger.warning("⚠️ No trained risk model found — using rule-based scoring only")

        # Load release readiness model
        release_model = load_release_model()
        app.state.release_model = release_model
        if release_model is not None:
            logger.info("✅ ML release model loaded successfully")
        else:
            logger.warning("⚠️ No trained release model found — using rule-based release scoring only")
    except Exception as e:
        logger.error(f"❌ Failed to load ML models: {e}")
        app.state.ml_model = None
        app.state.model_loaded = False
        app.state.release_model = None

    logger.info("✅ ML Service ready")

    yield  # Application runs here

    # Shutdown: cleanup resources
    logger.info("🔌 Shutting down ML Service...")
    app.state.ml_model = None
    app.state.release_model = None


# ── Initialize FastAPI App ──────────────────────────────────
app = FastAPI(
    title="Delivery Risk ML Service",
    description="AI/ML microservice for sprint risk prediction, PR summarization, and delivery analytics",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS Configuration ──────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Frontend
        "http://localhost:5000",  # Backend
        "http://backend:5000",   # Backend (Docker internal)
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request Logging Middleware ──────────────────────────────
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log every request with timestamp and processing time."""
    start_time = time.time()
    response = await call_next(request)
    elapsed = round(time.time() - start_time, 3)

    logger.info(
        f"{request.method} {request.url.path} "
        f"→ {response.status_code} ({elapsed}s)"
    )

    response.headers["X-Process-Time"] = str(elapsed)
    return response


# ── Health Check ────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health_check():
    """Service health check endpoint."""
    return {
        "status": "ok",
        "service": "delivery-risk-ml-service",
        "version": "1.0.0",
        "model_loaded": getattr(app.state, "model_loaded", False),
        "release_model_loaded": getattr(app.state, "release_model", None) is not None,
    }


@app.get("/", tags=["Root"])
async def root():
    """Root endpoint with API information."""
    return {
        "service": "Delivery Risk ML Service",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
        "endpoints": {
            "risk_score": "/api/risk/score",
            "release_readiness": "/api/release/predict",
            "hotspot_analysis": "/api/hotspots/analyze",
            "pr_summarization": "/api/pr/summarize",
            "staffing_analysis": "/api/staffing/analyze",
            "benchmark": "/api/benchmark/compute",
        },
    }


# ── Register Routers ───────────────────────────────────────
from app.routers.risk_router import router as risk_router
from app.routers.hotspot_router import router as hotspot_router
from app.routers.pr_router import router as pr_router
from app.routers.staffing_router import router as staffing_router
from app.routers.benchmark_router import router as benchmark_router
from app.routers.release_router import router as release_router

app.include_router(risk_router)
app.include_router(hotspot_router)
app.include_router(pr_router)
app.include_router(staffing_router)
app.include_router(benchmark_router)
app.include_router(release_router)


# ── Run with uvicorn ────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", 8000)),
        reload=os.getenv("DEBUG", "true").lower() == "true",
    )
