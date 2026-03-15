import os
import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.config import settings
from app.database import get_db
from app.models import Run, Customer
from app.schemas import RunOut, RunDetailOut, CustomerOut

router = APIRouter()


@router.get("/runs", response_model=List[RunOut])
def list_runs(db: Session = Depends(get_db)):
    """List all pipeline runs."""
    return db.query(Run).order_by(Run.created_at.desc()).all()


@router.get("/runs/{run_id}", response_model=RunDetailOut)
def get_run(run_id: int, db: Session = Depends(get_db)):
    """Get run details including flagged customers and risk distribution."""
    run = db.query(Run).filter(Run.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    # Get flagged customers (sorted by risk score descending)
    customers = (
        db.query(Customer)
        .filter(Customer.run_id == run_id, Customer.is_flagged == True)
        .order_by(Customer.risk_score.desc())
        .all()
    )

    # Build risk distribution histogram
    all_scores = (
        db.query(Customer.risk_score)
        .filter(Customer.run_id == run_id)
        .all()
    )
    risk_distribution = _build_histogram([s[0] for s in all_scores])

    # Portfolio risk: total volume, volume through flagged accounts, %
    portfolio_risk = _build_portfolio_risk(customers, run_id)

    # Precision@top 3%: among accounts with risk_score >= 0.97, fraction that are ground-truth positives
    precision_at_top_003 = _precision_at_top_risk(db, run_id, threshold=0.97)

    result = RunDetailOut.model_validate(run)
    result.customers = [CustomerOut.model_validate(c) for c in customers]
    result.risk_distribution = risk_distribution
    result.portfolio_risk = portfolio_risk
    result.precision_at_top_003 = precision_at_top_003

    return result


def _build_histogram(scores: list, bins: int = 20) -> list:
    """Build histogram data for Recharts."""
    if not scores:
        return []
    counts, edges = np.histogram(scores, bins=bins, range=(0, 1))
    return [
        {
            "range": f"{edges[i]:.2f}-{edges[i+1]:.2f}",
            "count": int(counts[i]),
            "min": float(edges[i]),
            "max": float(edges[i+1]),
        }
        for i in range(len(counts))
    ]


def _precision_at_top_risk(db: Session, run_id: int, threshold: float = 0.97) -> float | None:
    """Precision among accounts with risk_score >= threshold (ground truth from alert_accounts)."""
    top = (
        db.query(Customer)
        .filter(Customer.run_id == run_id, Customer.risk_score >= threshold)
        .all()
    )
    if not top:
        return None
    with_ground_truth = [c for c in top if c.ground_truth_flagged is not None]
    if not with_ground_truth:
        return None
    tp = sum(1 for c in with_ground_truth if c.ground_truth_flagged is True)
    return round(tp / len(with_ground_truth), 4)


def _build_portfolio_risk(customers: list, run_id: int) -> dict:
    """Compute total transaction volume, volume through flagged accounts, and % at risk."""
    out = {
        "total_volume": 0.0,
        "flagged_volume": 0.0,
        "flagged_pct": 0.0,
        "transaction_count": 0,
    }
    run_dir = os.path.join(settings.upload_dir, str(run_id))
    if not os.path.isdir(run_dir):
        return out
    try:
        from app.services.ingestion import load_csv_files, normalize_columns
        dfs = load_csv_files(run_dir)
        dfs = normalize_columns(dfs)
        tx = dfs["transactions"]
        out["transaction_count"] = len(tx)
        if "amount" not in tx.columns:
            return out
        amounts = pd.to_numeric(tx["amount"], errors="coerce").fillna(0)
        total_volume = float(amounts.sum())
        out["total_volume"] = total_volume
        if total_volume <= 0:
            return out
        flagged_ids = {c.acct_id for c in customers}
        if "orig_acct" in tx.columns and "bene_acct" in tx.columns:
            orig_in = tx["orig_acct"].astype(int).isin(flagged_ids)
            bene_in = tx["bene_acct"].astype(int).isin(flagged_ids)
            through_flagged = amounts[orig_in | bene_in].sum()
            out["flagged_volume"] = float(through_flagged)
            out["flagged_pct"] = round(100.0 * through_flagged / total_volume, 2)
    except Exception:
        pass
    return out
