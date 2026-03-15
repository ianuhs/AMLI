import logging
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


def compute_tabular_features(dfs: dict) -> pd.DataFrame:
    """
    Compute per-account tabular features from transactions and account data.
    Returns a DataFrame with one row per account.
    """
    tx = dfs["transactions"]
    accounts = dfs["accounts"]

    logger.info("Computing tabular features for %d accounts", len(accounts))

    # --- Sending features ---
    sent = tx.groupby("orig_acct").agg(
        total_sent=("amount", "sum"),
        avg_sent=("amount", "mean"),
        std_sent=("amount", "std"),
        max_sent=("amount", "max"),
        tx_count_sent=("amount", "count"),
        unique_recipients=("bene_acct", "nunique"),
    ).reset_index().rename(columns={"orig_acct": "acct_id"})

    # --- Receiving features ---
    recv = tx.groupby("bene_acct").agg(
        total_received=("amount", "sum"),
        avg_received=("amount", "mean"),
        std_received=("amount", "std"),
        max_received=("amount", "max"),
        tx_count_received=("amount", "count"),
        unique_senders=("orig_acct", "nunique"),
    ).reset_index().rename(columns={"bene_acct": "acct_id"})

    # --- Transaction type distribution (for sender) ---
    if "tx_type" in tx.columns:
        type_counts = tx.groupby(["orig_acct", "tx_type"]).size().unstack(fill_value=0)
        type_pcts = type_counts.div(type_counts.sum(axis=1), axis=0)
        type_pcts.columns = [f"pct_{c.lower()}" for c in type_pcts.columns]
        type_pcts = type_pcts.reset_index().rename(columns={"orig_acct": "acct_id"})
    else:
        type_pcts = None

    # --- Structuring indicator (tx just below $10,000 threshold) ---
    structuring = tx[tx["amount"].between(9000, 9999)].groupby("orig_acct").size()
    structuring = structuring.reset_index().rename(
        columns={"orig_acct": "acct_id", 0: "structuring_count"}
    )

    # --- Temporal velocity (transactions per time window) ---
    if "timestamp" in tx.columns:
        try:
            tx_ts = tx.copy()
            tx_ts["timestamp"] = pd.to_datetime(tx_ts["timestamp"], errors="coerce")
            if tx_ts["timestamp"].notna().any():
                tx_ts["date"] = tx_ts["timestamp"].dt.date
                daily = tx_ts.groupby(["orig_acct", "date"]).size().reset_index(name="daily_count")
                velocity = daily.groupby("orig_acct").agg(
                    max_daily_tx=("daily_count", "max"),
                    avg_daily_tx=("daily_count", "mean"),
                    active_days=("date", "nunique"),
                ).reset_index().rename(columns={"orig_acct": "acct_id"})
            else:
                velocity = None
        except Exception:
            velocity = None
    else:
        velocity = None

    # --- Entity type from accounts ---
    entity_type = accounts[["acct_id"]].copy()
    if "type" in accounts.columns:
        entity_type["is_individual"] = (accounts["type"] == "I").astype(int)
    else:
        entity_type["is_individual"] = 1

    # --- Merge everything ---
    features = accounts[["acct_id"]].copy()
    features = features.merge(sent, on="acct_id", how="left")
    features = features.merge(recv, on="acct_id", how="left")
    features = features.merge(structuring, on="acct_id", how="left")
    features = features.merge(entity_type, on="acct_id", how="left")

    if type_pcts is not None:
        features = features.merge(type_pcts, on="acct_id", how="left")

    if velocity is not None:
        features = features.merge(velocity, on="acct_id", how="left")

    # Fill NaN with 0 for numeric columns
    numeric_cols = features.select_dtypes(include=[np.number]).columns
    features[numeric_cols] = features[numeric_cols].fillna(0)

    # --- Derived ratios ---
    features["sent_recv_ratio"] = np.where(
        features["total_received"] > 0,
        features["total_sent"] / features["total_received"],
        0,
    )
    features["tx_count_total"] = features["tx_count_sent"] + features["tx_count_received"]
    features["counterparty_ratio"] = np.where(
        features["unique_senders"] > 0,
        features["unique_recipients"] / features["unique_senders"],
        0,
    )

    logger.info("Computed %d features for %d accounts", len(features.columns) - 1, len(features))
    return features
