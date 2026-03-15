import os
import shutil
from fastapi import APIRouter, UploadFile, File, BackgroundTasks, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Run
from app.schemas import UploadResponse
from app.config import settings
from app.pipeline import run_pipeline

router = APIRouter()


@router.post("/upload", response_model=UploadResponse)
async def upload_files(
    background_tasks: BackgroundTasks,
    transactions: UploadFile = File(...),
    accounts: UploadFile = File(...),
    alert_accounts: UploadFile = File(None),
    db: Session = Depends(get_db),
):
    """Upload CSV files and start the AML detection pipeline. Optional alert_accounts.csv for validation (true/false positive)."""
    # Create run record
    run = Run(filename=transactions.filename, status="pending")
    db.add(run)
    db.commit()
    db.refresh(run)

    # Save uploaded files to disk
    run_dir = os.path.join(settings.upload_dir, str(run.id))
    os.makedirs(run_dir, exist_ok=True)

    file_map = {
        "transactions.csv": transactions,
        "accounts.csv": accounts,
    }
    if alert_accounts:
        file_map["alert_accounts.csv"] = alert_accounts

    for fname, upload in file_map.items():
        path = os.path.join(run_dir, fname)
        with open(path, "wb") as f:
            shutil.copyfileobj(upload.file, f)

    # Launch pipeline in background
    background_tasks.add_task(run_pipeline, run.id, run_dir)

    return UploadResponse(
        run_id=run.id,
        status="pending",
        message="Files uploaded. Pipeline started.",
    )
