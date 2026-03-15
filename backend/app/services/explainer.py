import logging
import shap
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


def compute_shap_values(model, features_df: pd.DataFrame, feature_cols: list) -> dict:
    """
    Compute SHAP values for all accounts and return per-account explanations.
    Returns a dict: {acct_id: [{name, value, contribution}, ...]}
    """
    X = features_df[feature_cols].copy()
    for col in X.columns:
        X[col] = pd.to_numeric(X[col], errors="coerce").fillna(0)

    logger.info("Computing SHAP values with TreeExplainer...")
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X)

    # For binary classification, shap_values may be a list [class_0, class_1]
    if isinstance(shap_values, list):
        sv = shap_values[1]  # Use class 1 (suspicious)
    else:
        sv = shap_values

    logger.info("SHAP values shape: %s", sv.shape)

    # Build per-account top feature contributions
    explanations = {}
    for idx in range(len(features_df)):
        acct_id = features_df.iloc[idx]["acct_id"]
        feature_contribs = []
        for j, col in enumerate(feature_cols):
            feature_contribs.append({
                "name": col,
                "value": float(X.iloc[idx][col]),
                "contribution": float(sv[idx, j]),
            })

        # Sort by absolute contribution, take top 10
        feature_contribs.sort(key=lambda x: abs(x["contribution"]), reverse=True)
        explanations[acct_id] = feature_contribs[:10]

    logger.info("SHAP explanations computed for %d accounts", len(explanations))
    return explanations
