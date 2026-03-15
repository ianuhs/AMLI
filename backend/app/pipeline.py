import os
import logging
import datetime
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Run, Customer, Report
from app.services.ingestion import load_csv_files, normalize_columns
from app.services.features import compute_tabular_features
from app.services.graph import compute_graph_features
from app.services.model import load_pretrained_model, predict_risk_scores, get_alert_type_map
from app.services.explainer import compute_shap_values
from app.services.llm import generate_llm_summary
from app.services.pdf import generate_pdf_report
from app.config import settings

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

# Path to pre-trained model files
MODEL_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models")


def run_pipeline(run_id: int, run_dir: str):
    """
    Execute the AML detection pipeline using a PRE-TRAINED model:
    1. Ingest CSV data
    2. Compute features (tabular + graph)
    3. Load pre-trained LightGBM model
    4. Predict risk scores
    5. Compute SHAP explanations
    6. Generate LLM summaries (IBM watsonx)
    7. Generate PDF report
    """
    db: Session = SessionLocal()

    try:
        _update_status(db, run_id, "processing")

        # Step 1: Load and normalize data
        logger.info("=== Step 1: Loading CSV data ===")
        dfs = load_csv_files(run_dir)
        dfs = normalize_columns(dfs)

        # Step 2: Tabular features
        logger.info("=== Step 2: Computing tabular features ===")
        features_df = compute_tabular_features(dfs)

        # Step 3: Graph features
        logger.info("=== Step 3: Computing graph features ===")
        features_df = compute_graph_features(dfs, features_df)

        # Step 4: Load pre-trained model
        logger.info("=== Step 4: Loading pre-trained model ===")
        model, feature_cols, auc = load_pretrained_model(MODEL_DIR)

        # Step 5: Predict risk scores
        logger.info("=== Step 5: Predicting risk scores ===")
        risk_scores = predict_risk_scores(model, features_df, feature_cols)
        features_df["risk_score"] = risk_scores

        # Step 6: Compute SHAP values for flagged accounts only
        logger.info("=== Step 6: Computing SHAP explanations ===")
        flagged_mask = features_df["risk_score"] >= settings.risk_threshold
        shap_explanations = compute_shap_values(model, features_df, feature_cols, flagged_mask=flagged_mask)

        # Step 7: Identify flagged accounts
        alert_type_map = get_alert_type_map(dfs)
        flagged_count = int(flagged_mask.sum())
        total_accounts = len(features_df)
        logger.info("Flagged %d / %d accounts (threshold=%.2f)", flagged_count, total_accounts, settings.risk_threshold)

        # Step 8: Generate LLM summaries for flagged accounts
        logger.info("=== Step 8: Generating LLM summaries ===")
        accounts_df = dfs["accounts"]
        account_names = dict(zip(accounts_df["acct_id"], accounts_df.get("display_name", accounts_df["acct_id"])))
        account_types = {}
        if "type" in accounts_df.columns:
            account_types = dict(zip(accounts_df["acct_id"], accounts_df["type"].map({"I": "Individual", "O": "Organization"})))

        # Save customers to DB
        logger.info("=== Saving results to database ===")
        customer_records = []
        flagged_data_for_pdf = []

        for idx, row in features_df.iterrows():
            acct_id = row["acct_id"]
            score = row["risk_score"]
            is_flagged = bool(score >= settings.risk_threshold)
            alert_type = alert_type_map.get(acct_id)
            top_features = shap_explanations.get(acct_id, [])

            # Generate LLM summary only for flagged accounts (up to max)
            llm_summary = None
            if is_flagged and len(flagged_data_for_pdf) < settings.max_llm_accounts:
                llm_summary = generate_llm_summary(acct_id, score, top_features, alert_type)

            cust = Customer(
                run_id=run_id,
                acct_id=int(acct_id),
                display_name=str(account_names.get(acct_id, f"Account {acct_id}")),
                entity_type=account_types.get(acct_id, "Unknown"),
                risk_score=float(score),
                is_flagged=is_flagged,
                alert_type=alert_type,
                shap_values={f["name"]: f["contribution"] for f in top_features} if top_features else None,
                top_features=top_features,
                llm_summary=llm_summary,
                total_sent=float(row.get("total_sent", 0)),
                total_received=float(row.get("total_received", 0)),
                tx_count=int(row.get("tx_count_total", 0)),
                in_degree=int(row.get("in_degree", 0)),
                out_degree=int(row.get("out_degree", 0)),
                pagerank=float(row.get("pagerank", 0)),
            )
            customer_records.append(cust)

            if is_flagged:
                flagged_data_for_pdf.append({
                    "acct_id": int(acct_id),
                    "risk_score": float(score),
                    "alert_type": alert_type,
                    "entity_type": account_types.get(acct_id, "Unknown"),
                    "top_features": top_features,
                    "llm_summary": llm_summary,
                })

        db.bulk_save_objects(customer_records)
        db.commit()
        logger.info("Saved %d customer records", len(customer_records))

        # Step 9: Generate PDF report
        logger.info("=== Step 9: Generating PDF report ===")
        pdf_path = generate_pdf_report(
            run_id=run_id,
            total_accounts=total_accounts,
            flagged_count=flagged_count,
            model_auc=auc,
            flagged_customers=flagged_data_for_pdf,
        )

        report = Report(run_id=run_id, pdf_path=pdf_path)
        db.add(report)

        # Update run as completed
        run = db.query(Run).filter(Run.id == run_id).first()
        run.status = "done"
        run.total_accounts = total_accounts
        run.flagged_count = flagged_count
        run.model_auc = float(auc)
        run.completed_at = datetime.datetime.utcnow()
        db.commit()

        logger.info("=== Pipeline complete for run %d ===", run_id)

    except Exception as e:
        logger.error("Pipeline failed for run %d: %s", run_id, str(e), exc_info=True)
        _update_status(db, run_id, "error", str(e))
    finally:
        db.close()


def _update_status(db: Session, run_id: int, status: str, error_message: str = None):
    """Update the run status in the database."""
    run = db.query(Run).filter(Run.id == run_id).first()
    if run:
        run.status = status
        if error_message:
            run.error_message = error_message
        db.commit()
