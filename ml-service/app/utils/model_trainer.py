"""
ML Model Trainer
Trains XGBoost and LightGBM classifiers on sprint feature data from PostgreSQL.

Handles:
- Data loading from PostgreSQL sprint_features table
- Feature preparation and class imbalance handling
- Stratified train/test split and 5-fold cross-validation
- Model evaluation (accuracy, F1, ROC-AUC, precision, recall)
- Feature importance logging
- Model serialization to disk

Usage:
    python -m app.utils.model_trainer
"""

import os
import sys
import numpy as np
import pandas as pd
import joblib
from pathlib import Path
from loguru import logger

# Add parent directory to path for standalone execution
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))


# ═══════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════

MODEL_DIR = Path(__file__).resolve().parent.parent / "models" / "saved"
XGBOOST_MODEL_PATH = MODEL_DIR / "risk_model.pkl"
LGBM_MODEL_PATH = MODEL_DIR / "lgbm_risk_model.pkl"

# Feature columns used by the model — MUST match feature_engineering.py FEATURE_COLUMNS
from app.utils.feature_engineering import FEATURE_COLUMNS

TARGET_COLUMN = "was_delayed"


# ═══════════════════════════════════════════════════════════
# DATA LOADING
# ═══════════════════════════════════════════════════════════

def load_training_data(postgres_uri: str = None) -> pd.DataFrame:
    """
    Load sprint features from PostgreSQL for model training.

    Args:
        postgres_uri: PostgreSQL connection string.

    Returns:
        DataFrame with sprint features and target label.
    """
    from dotenv import load_dotenv
    load_dotenv()

    uri = postgres_uri or os.getenv(
        "POSTGRES_URI",
        "postgresql://drp_user:drp_secret_2024@localhost:5432/ml_feature_store"
    )

    try:
        import psycopg2
        conn = psycopg2.connect(uri)
        df = pd.read_sql("SELECT * FROM sprint_features", conn)
        conn.close()
    except ImportError:
        # Fallback to sqlalchemy if psycopg2 not available
        from sqlalchemy import create_engine
        engine = create_engine(uri)
        df = pd.read_sql("SELECT * FROM sprint_features", engine)
        engine.dispose()

    logger.info(f"Loaded {len(df)} sprint feature records from PostgreSQL")

    # Handle missing values
    df = df.fillna(0)

    return df


def generate_synthetic_training_data(n_samples: int = 500) -> pd.DataFrame:
    """
    Generate synthetic training data when PostgreSQL is not available.
    This creates realistic-looking sprint features for model training.

    Feature names MUST match FEATURE_COLUMNS from feature_engineering.py:
    commit_frequency_zscore, pr_review_lag_ratio, churn_rate, scope_creep_score,
    reopen_rate, velocity_trend, blocked_ratio, days_pressure,
    team_utilization, sentiment_score
    """
    logger.info(f"Generating {n_samples} synthetic training samples...")

    np.random.seed(42)
    data = []

    for i in range(n_samples):
        # Determine if this sprint will be "delayed" (30% chance)
        is_delayed = np.random.random() < 0.3

        if is_delayed:
            # Delayed sprints have worse metrics
            row = {
                "commit_frequency_zscore": np.random.uniform(-3.0, -0.5),
                "pr_review_lag_ratio": np.random.uniform(1.5, 4.0),
                "churn_rate": np.random.uniform(1.5, 3.0),
                "scope_creep_score": np.random.uniform(0.2, 0.6),
                "reopen_rate": np.random.uniform(0.15, 0.5),
                "velocity_trend": np.random.uniform(0.4, 0.85),
                "blocked_ratio": np.random.uniform(0.15, 0.5),
                "days_pressure": np.random.uniform(0.1, 0.35),
                "team_utilization": np.random.uniform(3.0, 7.0),
                "sentiment_score": np.random.uniform(-0.6, 0.0),
                "was_delayed": True,
            }
        else:
            # On-time sprints have better metrics
            row = {
                "commit_frequency_zscore": np.random.uniform(-0.5, 2.0),
                "pr_review_lag_ratio": np.random.uniform(0.5, 1.8),
                "churn_rate": np.random.uniform(0.8, 1.5),
                "scope_creep_score": np.random.uniform(0.0, 0.15),
                "reopen_rate": np.random.uniform(0.0, 0.1),
                "velocity_trend": np.random.uniform(0.85, 1.3),
                "blocked_ratio": np.random.uniform(0.0, 0.12),
                "days_pressure": np.random.uniform(0.3, 0.8),
                "team_utilization": np.random.uniform(1.0, 3.5),
                "sentiment_score": np.random.uniform(0.1, 0.7),
                "was_delayed": False,
            }

        # Add noise to make data more realistic
        for key in row:
            if isinstance(row[key], float):
                row[key] += np.random.normal(0, abs(row[key]) * 0.05)

        data.append(row)

    return pd.DataFrame(data)


# ═══════════════════════════════════════════════════════════
# MODEL TRAINING
# ═══════════════════════════════════════════════════════════

def train_models(df: pd.DataFrame) -> dict:
    """
    Train XGBoost and LightGBM classifiers on sprint feature data.

    Args:
        df: DataFrame with feature columns and target column.

    Returns:
        Dictionary with trained models and evaluation metrics.
    """
    from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
    from sklearn.metrics import (
        accuracy_score, f1_score, roc_auc_score,
        precision_score, recall_score, classification_report,
    )

    logger.info("=" * 50)
    logger.info("TRAINING SPRINT DELAY PREDICTION MODELS")
    logger.info("=" * 50)

    # ── Prepare features and target ───────────────────────
    available_features = [c for c in FEATURE_COLUMNS if c in df.columns]
    logger.info(f"Using {len(available_features)} features: {available_features}")

    X = df[available_features].values
    y = df[TARGET_COLUMN].astype(int).values

    logger.info(f"Dataset: {len(X)} samples, {y.sum()} delayed ({y.mean():.1%})")

    # ── Handle class imbalance ────────────────────────────
    n_negative = (y == 0).sum()
    n_positive = (y == 1).sum()
    scale_pos_weight = n_negative / max(n_positive, 1)
    logger.info(f"Class balance: {n_negative} on-time, {n_positive} delayed")
    logger.info(f"scale_pos_weight: {scale_pos_weight:.2f}")

    # ── Train-test split ──────────────────────────────────
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=42
    )
    logger.info(f"Train: {len(X_train)}, Test: {len(X_test)}")

    results = {}

    # ── Train XGBoost ─────────────────────────────────────
    try:
        from xgboost import XGBClassifier

        logger.info("\n📊 Training XGBoost classifier...")
        xgb_model = XGBClassifier(
            n_estimators=200,
            max_depth=5,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            scale_pos_weight=scale_pos_weight,
            random_state=42,
            eval_metric="logloss",
            use_label_encoder=False,
        )
        xgb_model.fit(X_train, y_train)

        # Evaluate
        y_pred = xgb_model.predict(X_test)
        y_proba = xgb_model.predict_proba(X_test)[:, 1]

        xgb_metrics = {
            "accuracy": round(accuracy_score(y_test, y_pred), 4),
            "f1": round(f1_score(y_test, y_pred, zero_division=0), 4),
            "roc_auc": round(roc_auc_score(y_test, y_proba), 4),
            "precision": round(precision_score(y_test, y_pred, zero_division=0), 4),
            "recall": round(recall_score(y_test, y_pred, zero_division=0), 4),
        }

        logger.info(f"XGBoost Results: {xgb_metrics}")

        # Cross-validation
        cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
        cv_f1 = cross_val_score(xgb_model, X, y, cv=cv, scoring="f1")
        cv_auc = cross_val_score(xgb_model, X, y, cv=cv, scoring="roc_auc")
        logger.info(f"5-Fold CV F1: {cv_f1.mean():.4f} ± {cv_f1.std():.4f}")
        logger.info(f"5-Fold CV AUC: {cv_auc.mean():.4f} ± {cv_auc.std():.4f}")

        # Feature importance
        importances = xgb_model.feature_importances_
        feature_imp = sorted(
            zip(available_features, importances),
            key=lambda x: x[1], reverse=True
        )
        logger.info("Top 5 features:")
        for feat, imp in feature_imp[:5]:
            logger.info(f"  {feat}: {imp:.4f}")

        # Save model
        MODEL_DIR.mkdir(parents=True, exist_ok=True)
        joblib.dump(xgb_model, XGBOOST_MODEL_PATH)
        logger.info(f"✅ XGBoost model saved to {XGBOOST_MODEL_PATH}")

        results["xgboost"] = {"model": xgb_model, "metrics": xgb_metrics}

    except ImportError:
        logger.warning("XGBoost not installed, skipping XGBoost training")

    # ── Train LightGBM ────────────────────────────────────
    try:
        from lightgbm import LGBMClassifier

        logger.info("\n📊 Training LightGBM classifier...")
        lgbm_model = LGBMClassifier(
            n_estimators=200,
            max_depth=5,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            scale_pos_weight=scale_pos_weight,
            random_state=42,
            verbose=-1,
        )
        lgbm_model.fit(X_train, y_train)

        y_pred = lgbm_model.predict(X_test)
        y_proba = lgbm_model.predict_proba(X_test)[:, 1]

        lgbm_metrics = {
            "accuracy": round(accuracy_score(y_test, y_pred), 4),
            "f1": round(f1_score(y_test, y_pred, zero_division=0), 4),
            "roc_auc": round(roc_auc_score(y_test, y_proba), 4),
            "precision": round(precision_score(y_test, y_pred, zero_division=0), 4),
            "recall": round(recall_score(y_test, y_pred, zero_division=0), 4),
        }

        logger.info(f"LightGBM Results: {lgbm_metrics}")

        joblib.dump(lgbm_model, LGBM_MODEL_PATH)
        logger.info(f"✅ LightGBM model saved to {LGBM_MODEL_PATH}")

        results["lightgbm"] = {"model": lgbm_model, "metrics": lgbm_metrics}

    except ImportError:
        logger.warning("LightGBM not installed, skipping LightGBM training")

    return results


# ═══════════════════════════════════════════════════════════
# MODEL LOADING
# ═══════════════════════════════════════════════════════════

_loaded_model = None


def load_model(model_path: str = None):
    """
    Load the trained risk prediction model from disk.

    Tries XGBoost first, falls back to LightGBM.

    Returns:
        Loaded model object, or None if no model is available.
    """
    global _loaded_model

    if _loaded_model is not None:
        return _loaded_model

    # Try XGBoost model first
    xgb_path = Path(model_path) if model_path else XGBOOST_MODEL_PATH
    if xgb_path.exists():
        try:
            _loaded_model = joblib.load(xgb_path)
            logger.info(f"✅ Loaded XGBoost model from {xgb_path}")
            return _loaded_model
        except Exception as e:
            logger.warning(f"Failed to load XGBoost model: {e}")

    # Try LightGBM model as backup
    if LGBM_MODEL_PATH.exists():
        try:
            _loaded_model = joblib.load(LGBM_MODEL_PATH)
            logger.info(f"✅ Loaded LightGBM model from {LGBM_MODEL_PATH}")
            return _loaded_model
        except Exception as e:
            logger.warning(f"Failed to load LightGBM model: {e}")

    logger.warning("⚠️ No trained model found — risk engine will use rule-based scoring only")
    return None


def predict_risk(features: dict, model=None) -> dict:
    """
    Make a risk prediction for a single sprint.

    Args:
        features: Dictionary of computed sprint features.
        model: Optional pre-loaded model. If None, loads from disk.

    Returns:
        {"delay_probability": float, "confidence": float}
    """
    if model is None:
        model = load_model()

    if model is None:
        return {"delay_probability": 0.5, "confidence": 0.0}

    try:
        from app.utils.feature_engineering import FEATURE_COLUMNS
        feature_vector = np.array([
            features.get(col, 0.0) for col in FEATURE_COLUMNS
        ]).reshape(1, -1)

        proba = model.predict_proba(feature_vector)[0]
        delay_prob = float(proba[1]) if len(proba) > 1 else float(proba[0])
        confidence = abs(delay_prob - 0.5) * 2

        return {
            "delay_probability": round(delay_prob, 4),
            "confidence": round(confidence, 4),
        }
    except Exception as e:
        logger.error(f"Prediction failed: {e}")
        return {"delay_probability": 0.5, "confidence": 0.0}


# ═══════════════════════════════════════════════════════════
# STANDALONE TRAINING SCRIPT
# ═══════════════════════════════════════════════════════════

if __name__ == "__main__":
    logger.info("Starting model training pipeline...")

    try:
        df = load_training_data()
    except Exception as e:
        logger.warning(f"Could not load from PostgreSQL: {e}")
        logger.info("Using synthetic training data instead...")
        df = generate_synthetic_training_data(500)

    results = train_models(df)

    logger.info("\n" + "=" * 50)
    logger.info("TRAINING COMPLETE")
    logger.info("=" * 50)
    for name, result in results.items():
        logger.info(f"\n{name.upper()} Metrics:")
        for metric, value in result["metrics"].items():
            logger.info(f"  {metric}: {value}")
