import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, JSON, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base


class Run(Base):
    __tablename__ = "runs"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    status = Column(String, default="pending")  # pending, processing, done, error
    error_message = Column(Text, nullable=True)
    total_accounts = Column(Integer, nullable=True)
    flagged_count = Column(Integer, nullable=True)
    model_auc = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    customers = relationship("Customer", back_populates="run", cascade="all, delete-orphan")
    report = relationship("Report", back_populates="run", uselist=False, cascade="all, delete-orphan")


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(Integer, ForeignKey("runs.id"), nullable=False)
    acct_id = Column(Integer, nullable=False)
    display_name = Column(String, nullable=True)
    entity_type = Column(String, nullable=True)  # Individual or Organization
    risk_score = Column(Float, nullable=False)
    is_flagged = Column(Boolean, default=False)
    alert_type = Column(String, nullable=True)  # fan_in, fan_out, cycle, or null
    ground_truth_flagged = Column(Boolean, nullable=True)  # True if in alert_accounts (validation only)
    shap_values = Column(JSON, nullable=True)  # {feature_name: shap_value}
    top_features = Column(JSON, nullable=True)  # [{name, value, contribution}]
    llm_summary = Column(Text, nullable=True)

    # Key features stored for dashboard display
    total_sent = Column(Float, nullable=True)
    total_received = Column(Float, nullable=True)
    tx_count = Column(Integer, nullable=True)
    in_degree = Column(Integer, nullable=True)
    out_degree = Column(Integer, nullable=True)
    pagerank = Column(Float, nullable=True)

    run = relationship("Run", back_populates="customers")


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(Integer, ForeignKey("runs.id"), nullable=False, unique=True)
    pdf_path = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    run = relationship("Run", back_populates="report")
