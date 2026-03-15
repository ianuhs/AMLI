from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime


class RunOut(BaseModel):
    id: int
    filename: str
    status: str
    error_message: Optional[str] = None
    total_accounts: Optional[int] = None
    flagged_count: Optional[int] = None
    model_auc: Optional[float] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CustomerOut(BaseModel):
    id: int
    acct_id: int
    display_name: Optional[str] = None
    entity_type: Optional[str] = None
    risk_score: float
    is_flagged: bool
    alert_type: Optional[str] = None
    ground_truth_flagged: Optional[bool] = None  # True/False when alert_accounts uploaded for validation
    top_features: Optional[List[Dict[str, Any]]] = None
    llm_summary: Optional[str] = None
    total_sent: Optional[float] = None
    total_received: Optional[float] = None
    tx_count: Optional[int] = None
    in_degree: Optional[int] = None
    out_degree: Optional[int] = None
    pagerank: Optional[float] = None

    class Config:
        from_attributes = True


class RunDetailOut(RunOut):
    customers: List[CustomerOut] = []
    risk_distribution: Optional[List[Dict[str, Any]]] = None
    portfolio_risk: Optional[Dict[str, Any]] = None  # total_volume, flagged_volume, flagged_pct, transaction_count
    precision_at_top_003: Optional[float] = None  # precision among risk_score >= 0.97 (when ground truth available)


class UploadResponse(BaseModel):
    run_id: int
    status: str
    message: str
