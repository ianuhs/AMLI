import logging
import shap
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


def compute_shap_values(model, features_df: pd.DataFrame, feature_cols: list, flagged_mask=None) -> dict:
    """
    Compute SHAP values for flagged accounts only (much faster than all accounts).
    
    Args:
        model: trained LightGBM model
        features_df: full features DataFrame with acct_id
        feature_cols: list of feature column names
        flagged_mask: boolean Series aligned to features_df index (True = flagged).
                      If None, SHAP is computed for all accounts.
    
    Returns a dict: {acct_id: [{name, value, contribution}, ...]}
    """
    if flagged_mask is not None:
        subset = features_df[flagged_mask].copy()
        logger.info("Computing SHAP values for %d flagged accounts (of %d total)", len(subset), len(features_df))
    else:
        subset = features_df.copy()
        logger.info("Computing SHAP values for all %d accounts", len(subset))

    if len(subset) == 0:
        logger.warning("No accounts to explain (empty subset).")
        return {}

    X = subset[feature_cols].copy()
    # Align columns: fill any missing feature with 0
    for col in feature_cols:
        if col not in X.columns:
            X[col] = 0
    X = X[feature_cols]
    for col in X.columns:
        X[col] = pd.to_numeric(X[col], errors="coerce").fillna(0)

    logger.info("Running TreeExplainer...")
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X)

    # For binary classification, shap_values may be a list [class_0, class_1]
    if isinstance(shap_values, list):
        sv = shap_values[1]  # class 1 = suspicious
    else:
        sv = shap_values

    logger.info("SHAP values shape: %s", sv.shape)

    # Build per-account top feature contributions
    explanations = {}
    for i, (idx, row) in enumerate(subset.iterrows()):
        acct_id = row["acct_id"]
        feature_contribs = [
            {
                "name": col,
                "value": float(X.iloc[i][col]),
                "contribution": float(sv[i, j]),
            }
            for j, col in enumerate(feature_cols)
        ]
        # Sort by absolute contribution, take top 10
        feature_contribs.sort(key=lambda x: abs(x["contribution"]), reverse=True)
        explanations[acct_id] = feature_contribs[:10]

    logger.info("SHAP explanations computed for %d accounts", len(explanations))
    return explanations
