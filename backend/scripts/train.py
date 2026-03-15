"""
Offline training script.

Run this ONCE on the full dataset to train LightGBM and save the model.
The saved model is then loaded by the pipeline at upload time for inference.

Usage:
    python -m scripts.train --data-dir ../data/run_50K_5M
"""

import os
import sys
import argparse
import pickle
import logging
import pandas as pd

# Add parent to path so we can import app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.ingestion import load_csv_files, normalize_columns
from app.services.features import compute_tabular_features
from app.services.graph import compute_graph_features
from app.services.model import build_labels, train_model

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

DEFAULT_MODEL_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models")


def main():
    parser = argparse.ArgumentParser(description="Train AML detection model offline")
    parser.add_argument("--data-dir", required=True, help="Path to data directory with CSV files")
    parser.add_argument("--model-dir", default=DEFAULT_MODEL_DIR, help="Output directory for saved model")
    args = parser.parse_args()

    os.makedirs(args.model_dir, exist_ok=True)

    # Step 1: Load data
    logger.info("=== Step 1: Loading CSV data from %s ===", args.data_dir)
    dfs = load_csv_files(args.data_dir)
    dfs = normalize_columns(dfs)

    # Step 2: Tabular features
    logger.info("=== Step 2: Computing tabular features ===")
    features_df = compute_tabular_features(dfs)

    # Step 3: Graph features
    logger.info("=== Step 3: Computing graph features ===")
    features_df = compute_graph_features(dfs, features_df)

    # Step 4: Build labels
    logger.info("=== Step 4: Building labels ===")
    labels = build_labels(features_df, dfs)

    # Step 5: Train model
    logger.info("=== Step 5: Training LightGBM ===")
    model, feature_cols, auc, X_all, y_all = train_model(features_df, labels)

    # Step 6: Save everything
    logger.info("=== Step 6: Saving model artifacts ===")

    model_path = os.path.join(args.model_dir, "lgbm_model.pkl")
    with open(model_path, "wb") as f:
        pickle.dump(model, f)
    logger.info("Model saved to %s", model_path)

    meta_path = os.path.join(args.model_dir, "model_meta.pkl")
    with open(meta_path, "wb") as f:
        pickle.dump({
            "feature_cols": feature_cols,
            "auc": auc,
            "n_train_samples": len(X_all),
            "n_positive": int(labels.sum()),
            "n_features": len(feature_cols),
        }, f)
    logger.info("Model metadata saved to %s", meta_path)

    logger.info("=== Training complete ===")
    logger.info("AUC: %.4f", auc)
    logger.info("Features: %d", len(feature_cols))
    logger.info("Samples: %d total, %d positive", len(X_all), int(labels.sum()))
    logger.info("")
    logger.info("Model files saved to: %s", args.model_dir)
    logger.info("  - lgbm_model.pkl")
    logger.info("  - model_meta.pkl")


if __name__ == "__main__":
    main()
