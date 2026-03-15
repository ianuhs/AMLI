import numpy as np
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

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

    # Build graph data for network visualization (flagged accounts only)
    graph_data = _build_graph_data(customers)

    result = RunDetailOut.model_validate(run)
    result.customers = [CustomerOut.model_validate(c) for c in customers]
    result.risk_distribution = risk_distribution
    result.graph_data = graph_data

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


def _build_graph_data(customers: list) -> dict:
    """Build nodes + edges for network visualization from flagged customers."""
    nodes = []
    edges = []

    for c in customers:
        nodes.append({
            "id": str(c.acct_id),
            "label": c.display_name or f"Acct {c.acct_id}",
            "risk_score": c.risk_score,
            "alert_type": c.alert_type,
            "in_degree": c.in_degree or 0,
            "out_degree": c.out_degree or 0,
        })

    # Group by alert_type to create edges within alert groups
    from collections import defaultdict
    groups = defaultdict(list)
    for c in customers:
        if c.alert_type:
            groups[c.alert_type].append(str(c.acct_id))

    for alert_type, acct_ids in groups.items():
        for i in range(len(acct_ids)):
            for j in range(i + 1, len(acct_ids)):
                edges.append({
                    "source": acct_ids[i],
                    "target": acct_ids[j],
                    "type": alert_type,
                })

    return {"nodes": nodes, "edges": edges}
