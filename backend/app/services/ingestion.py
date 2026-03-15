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
    tx_path = os.path.join(run_dir, "transactions-full.csv")
    if not os.path.exists(tx_path):
        tx_path = os.path.join(run_dir, "transactions.csv")
    acct_path = os.path.join(run_dir, "accounts.csv")

    logger.info("Loading transactions from %s", tx_path)
    dfs["transactions"] = pd.read_csv(tx_path)
    logger.info("Loaded %d transactions", len(dfs["transactions"]))

    logger.info("Loading accounts from %s", acct_path)
    dfs["accounts"] = pd.read_csv(acct_path)
    logger.info("Loaded %d accounts", len(dfs["accounts"]))

    # Optional: alert_accounts.csv only used by offline training (build_labels), not by pipeline
    optional = {
        "alert_accounts": "alert_accounts.csv",
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
    Transaction-specific renames (e.g. type -> tx_type) apply only to transactions
    so that accounts keep "type" for entity type (I/O -> Individual/Organization).
    """
    for key, df in dfs.items():
        # Lowercase all columns
        df.columns = [str(c).lower().strip() for c in df.columns]

        # Renames that apply to all dataframes
        col_map = {}
        for col in df.columns:
            if col in ("tran_id", "id", "transaction_id"):
                col_map[col] = "tran_id"
            elif col in ("orig_acct", "sender", "orig_id", "nameorig"):
                col_map[col] = "orig_acct"
            elif col in ("bene_acct", "receiver", "bene_id", "namedest"):
                col_map[col] = "bene_acct"
            elif col in ("base_amt", "amount", "tx_amount"):
                col_map[col] = "amount"
            elif col in ("tran_timestamp", "timestamp", "step"):
                col_map[col] = "timestamp"
            elif col == "account_id":
                col_map[col] = "acct_id"
            # type -> tx_type only for transactions; accounts keep "type" for entity (I/O)
            elif key == "transactions" and col in ("tx_type", "type", "tran_type"):
                col_map[col] = "tx_type"

        if col_map:
            dfs[key] = df.rename(columns=col_map)

    return dfs
