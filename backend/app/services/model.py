import logging
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
    Create binary labels: 1 if account appears in alert_accounts, 0 otherwise.
    """
    if "alert_accounts" in dfs and len(dfs["alert_accounts"]) > 0:
        alert_accts = dfs["alert_accounts"]
        suspicious_ids = set(alert_accts["acct_id"].unique())
        labels = features_df["acct_id"].isin(suspicious_ids).astype(int)
        logger.info(
            "Labels: %d suspicious / %d total (%.2f%%)",
            labels.sum(), len(labels), 100 * labels.sum() / len(labels),
        )
        return labels
    else:
        logger.warning("No alert_accounts data found. Using all-zero labels.")
        return pd.Series(np.zeros(len(features_df)), dtype=int)


def get_alert_type_map(dfs: dict) -> dict:
    """Get mapping of acct_id → alert_type from alert_accounts."""
    if "alert_accounts" not in dfs:
        return {}

    alert = dfs["alert_accounts"]
    # Take the first alert type per account
    return dict(
        alert.groupby("acct_id")["alert_type"].first().items()
    )


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

    model = lgb.LGBMClassifier(
        objective="binary",
        metric="auc",
        is_unbalance=True,
        learning_rate=0.05,
        num_leaves=31,
        max_depth=6,
        min_child_samples=5,
        n_estimators=300,
        verbose=-1,
        random_state=42,
    )

    model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
    )

    # Evaluate
    y_pred_proba = model.predict_proba(X_test)[:, 1]
    auc = roc_auc_score(y_test, y_pred_proba)
    logger.info("Model AUC: %.4f", auc)
    logger.info("\n%s", classification_report(y_test, (y_pred_proba >= 0.5).astype(int)))

    return model, feature_cols, auc, X, y


def predict_risk_scores(model, features_df: pd.DataFrame, feature_cols: list) -> np.ndarray:
    """Predict risk scores for all accounts."""
    X = features_df[feature_cols].copy()
    for col in X.columns:
        X[col] = pd.to_numeric(X[col], errors="coerce").fillna(0)

    scores = model.predict_proba(X)[:, 1]
    logger.info(
        "Risk scores: min=%.4f, max=%.4f, mean=%.4f",
        scores.min(), scores.max(), scores.mean(),
    )
    return scores
