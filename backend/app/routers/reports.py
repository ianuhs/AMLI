import os
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Report

router = APIRouter()


@router.get("/reports/{run_id}/download")
def download_report(run_id: int, db: Session = Depends(get_db)):
    """Download the PDF report for a completed run."""
    report = db.query(Report).filter(Report.run_id == run_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if not os.path.exists(report.pdf_path):
        raise HTTPException(status_code=404, detail="PDF file not found on disk")

    return FileResponse(
        report.pdf_path,
        media_type="application/pdf",
        filename=f"aml_report_run_{run_id}.pdf",
    )
