import os
import logging
import pandas as pd

logger = logging.getLogger(__name__)


def load_csv_files(run_dir: str) -> dict:
    """
    Load all CSV files from the upload directory into pandas DataFrames.
    Returns a dict of DataFrames keyed by logical name.
    """
    dfs = {}

    # Required files
    tx_path = os.path.join(run_dir, "transactions.csv")
    acct_path = os.path.join(run_dir, "accounts.csv")

    logger.info("Loading transactions from %s", tx_path)
    dfs["transactions"] = pd.read_csv(tx_path)
    logger.info("Loaded %d transactions", len(dfs["transactions"]))

    logger.info("Loading accounts from %s", acct_path)
    dfs["accounts"] = pd.read_csv(acct_path)
    logger.info("Loaded %d accounts", len(dfs["accounts"]))

    # Optional files
    optional = {
        "alert_accounts": "alert_accounts.csv",
        "alert_transactions": "alert_transactions.csv",
        "account_mapping": "accountMapping.csv",
        "individuals": "individuals.csv",
        "organizations": "organizations.csv",
    }

    for key, fname in optional.items():
        path = os.path.join(run_dir, fname)
        if os.path.exists(path):
            dfs[key] = pd.read_csv(path)
            logger.info("Loaded %s: %d rows", key, len(dfs[key]))
        else:
            logger.info("Optional file %s not found, skipping", fname)

    return dfs


def normalize_columns(dfs: dict) -> dict:
    """
    Normalize column names across different data sources.
    AMLSim output varies slightly; standardize to lowercase with underscores.
    """
    tx = dfs["transactions"]

    # Detect and normalize transaction column names
    col_map = {}
    for col in tx.columns:
        lower = col.lower().strip()
        if lower in ("tran_id", "id", "transaction_id"):
            col_map[col] = "tran_id"
        elif lower in ("orig_acct", "sender", "orig_id", "nameOrig"):
            col_map[col] = "orig_acct"
        elif lower in ("bene_acct", "receiver", "bene_id", "nameDest"):
            col_map[col] = "bene_acct"
        elif lower in ("base_amt", "amount", "tx_amount"):
            col_map[col] = "amount"
        elif lower in ("tx_type", "type", "tran_type"):
            col_map[col] = "tx_type"
        elif lower in ("tran_timestamp", "timestamp", "step"):
            col_map[col] = "timestamp"

    if col_map:
        tx = tx.rename(columns=col_map)

    dfs["transactions"] = tx
    return dfs
