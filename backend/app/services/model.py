import os
import logging
import pickle
import numpy as np
import pandas as pd
import lightgbm as lgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, classification_report

logger = logging.getLogger(__name__)

# Features to exclude from model input
EXCLUDE_COLS = {"acct_id", "community_id"}


def build_labels(features_df: pd.DataFrame, dfs: dict) -> pd.Series:
    """
    Create binary labels for offline training: 1 if account appears in alert_accounts.
    Only used by scripts.train; pipeline does not use this.
    """
    if "alert_accounts" not in dfs or len(dfs["alert_accounts"]) == 0:
        logger.warning("No alert_accounts found. Using all-zero labels.")
        return pd.Series(np.zeros(len(features_df)), dtype=int)

    suspicious_ids = set(dfs["alert_accounts"]["acct_id"].unique())
    labels = features_df["acct_id"].isin(suspicious_ids).astype(int)
    logger.info(
        "Labels: %d suspicious / %d total (%.2f%%)",
        labels.sum(), len(labels), 100 * labels.sum() / len(labels),
    )
    return labels


def infer_alert_type(row) -> str:
    """
    Infer alert pattern from model features (in/out degree and sent/received).
    Used for display only; no ground-truth files required.
    """
    in_d = int(row.get("in_degree", 0) or 0)
    out_d = int(row.get("out_degree", 0) or 0)
    sent = float(row.get("total_sent", 0) or 0)
    recv = float(row.get("total_received", 0) or 0)

    # Require minimum activity to classify
    if in_d + out_d < 2:
        return "other"

    # Receiving-dominated → fan_in
    if in_d >= 1.5 * out_d and recv >= sent:
        return "fan_in"
    # Sending-dominated → fan_out
    if out_d >= 1.5 * in_d and sent >= recv:
        return "fan_out"
    # Balanced in/out with meaningful activity → cycle/layering
    if in_d >= 1 and out_d >= 1:
        ratio = out_d / in_d
        if 0.5 <= ratio <= 2:
            return "cycle"

    return "other"


def train_model(features_df: pd.DataFrame, labels: pd.Series) -> tuple:
    """
    Train a LightGBM binary classifier.
    Returns (model, feature_names, auc_score, X_test, y_test).
    """
    feature_cols = [c for c in features_df.columns if c not in EXCLUDE_COLS]
    X = features_df[feature_cols].copy()

    # Ensure all features are numeric
    for col in X.columns:
        X[col] = pd.to_numeric(X[col], errors="coerce").fillna(0)

    y = labels.values

    # Stratified split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    logger.info("Training LightGBM on %d samples (%d features)...", len(X_train), X.shape[1])

    # Precise class imbalance handling: weight negatives by ratio
    n_pos = int(y_train.sum())
    n_neg = len(y_train) - n_pos
    spw = n_neg / n_pos if n_pos > 0 else 1.0
    logger.info("scale_pos_weight=%.2f (neg=%d, pos=%d)", spw, n_neg, n_pos)

    model = lgb.LGBMClassifier(
        objective="binary",
        metric="auc",
        scale_pos_weight=spw,
        learning_rate=0.05,
        num_leaves=63,
        max_depth=7,
        min_child_samples=10,
        n_estimators=500,
        subsample=0.8,
        colsample_bytree=0.8,
        reg_alpha=0.1,
        reg_lambda=0.1,
        verbose=-1,
        random_state=42,
    )

    model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        callbacks=[lgb.early_stopping(stopping_rounds=50, verbose=False)],
    )

    # Evaluate
    y_pred_proba = model.predict_proba(X_test)[:, 1]
    auc = roc_auc_score(y_test, y_pred_proba)
    logger.info("Model AUC: %.4f", auc)
    logger.info("\n%s", classification_report(y_test, (y_pred_proba >= 0.5).astype(int)))

    return model, feature_cols, auc, X, y


def load_pretrained_model(model_dir: str) -> tuple:
    """
    Load a pre-trained model and its metadata from disk.
    Returns (model, feature_cols, auc) or raises FileNotFoundError.
    """
    model_path = os.path.join(model_dir, "lgbm_model.pkl")
    meta_path = os.path.join(model_dir, "model_meta.pkl")

    if not os.path.exists(model_path):
        raise FileNotFoundError(
            f"No pre-trained model found at {model_path}. "
            f"Run 'python -m scripts.train --data-dir <path>' first."
        )

    with open(model_path, "rb") as f:
        model = pickle.load(f)
    logger.info("Loaded pre-trained model from %s", model_path)

    with open(meta_path, "rb") as f:
        meta = pickle.load(f)
    logger.info(
        "Model meta: %d features, AUC=%.4f, trained on %d samples (%d positive)",
        meta["n_features"], meta["auc"], meta["n_train_samples"], meta["n_positive"],
    )

    return model, meta["feature_cols"], meta["auc"]


def predict_risk_scores(model, features_df: pd.DataFrame, feature_cols: list) -> np.ndarray:
    """Predict risk scores for all accounts."""
    X = features_df[feature_cols].copy()

    # Add any missing columns (features the model expects but aren't in this data)
    for col in feature_cols:
        if col not in X.columns:
            X[col] = 0
    X = X[feature_cols]  # ensure correct column order

    for col in X.columns:
        X[col] = pd.to_numeric(X[col], errors="coerce").fillna(0)

    scores = model.predict_proba(X)[:, 1]
    logger.info(
        "Risk scores: min=%.4f, max=%.4f, mean=%.4f",
        scores.min(), scores.max(), scores.mean(),
    )
    return scores
