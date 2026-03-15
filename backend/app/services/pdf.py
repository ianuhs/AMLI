import os
import logging
from datetime import datetime
from fpdf import FPDF

from app.config import settings

logger = logging.getLogger(__name__)


class AMLReport(FPDF):
    """Custom PDF report for AML analysis results."""

    def header(self):
        self.set_font("Helvetica", "B", 14)
        self.cell(0, 10, "AML Risk Analysis Report", ln=True, align="C")
        self.set_font("Helvetica", "", 9)
        self.cell(0, 6, f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}", ln=True, align="C")
        self.ln(5)
        self.set_draw_color(200, 200, 200)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(5)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.cell(0, 10, f"Page {self.page_no()}/{{nb}}", align="C")


def generate_pdf_report(
    run_id: int,
    total_accounts: int,
    flagged_count: int,
    model_auc: float,
    flagged_customers: list,
) -> str:
    """
    Generate a PDF report summarizing the AML analysis.
    Returns the file path of the generated PDF.
    """
    pdf = AMLReport()
    pdf.alias_nb_pages()
    pdf.add_page()

    # --- Executive Summary ---
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, "Executive Summary", ln=True)
    pdf.set_font("Helvetica", "", 10)
    pdf.ln(2)

    summary_lines = [
        f"Run ID: {run_id}",
        f"Total accounts analyzed: {total_accounts:,}",
        f"Accounts flagged: {flagged_count}",
        f"Model AUC: {model_auc:.4f}" if model_auc else "Model AUC: N/A",
        f"Flag rate: {100 * flagged_count / total_accounts:.2f}%" if total_accounts > 0 else "",
    ]
    for line in summary_lines:
        if line:
            pdf.cell(0, 6, line, ln=True)

    pdf.ln(5)

    # --- Flagged Accounts Table ---
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, "Flagged Accounts", ln=True)
    pdf.ln(2)

    # Table header
    pdf.set_font("Helvetica", "B", 9)
    col_widths = [25, 30, 25, 30, 80]
    headers = ["Account ID", "Risk Score", "Alert Type", "Entity Type", "Top Risk Factor"]
    for i, header in enumerate(headers):
        pdf.cell(col_widths[i], 7, header, border=1, align="C")
    pdf.ln()

    # Table rows
    pdf.set_font("Helvetica", "", 8)
    for cust in flagged_customers:
        top_feature = ""
        if cust.get("top_features") and len(cust["top_features"]) > 0:
            f = cust["top_features"][0]
            top_feature = f"{f['name']} ({f['contribution']:+.3f})"

        row = [
            str(cust.get("acct_id", "")),
            f"{cust.get('risk_score', 0):.4f}",
            str(cust.get("alert_type", "N/A")),
            str(cust.get("entity_type", "N/A")),
            top_feature[:45],
        ]
        for i, val in enumerate(row):
            pdf.cell(col_widths[i], 6, val, border=1)
        pdf.ln()

    pdf.ln(5)

    # --- Per-Customer Detail ---
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, "Detailed Customer Analysis", ln=True)
    pdf.ln(3)

    for cust in flagged_customers:
        # Check if we need a new page
        if pdf.get_y() > 240:
            pdf.add_page()

        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(0, 7, f"Account: {cust.get('acct_id', 'Unknown')}", ln=True)

        pdf.set_font("Helvetica", "", 9)
        pdf.cell(0, 5, f"Risk Score: {cust.get('risk_score', 0):.4f}  |  Alert Type: {cust.get('alert_type', 'N/A')}", ln=True)

        # LLM Summary
        if cust.get("llm_summary"):
            pdf.set_font("Helvetica", "I", 9)
            pdf.multi_cell(0, 5, cust["llm_summary"])

        # Top features
        if cust.get("top_features"):
            pdf.set_font("Helvetica", "", 8)
            pdf.cell(0, 5, "Key risk indicators:", ln=True)
            for f in cust["top_features"][:5]:
                pdf.cell(
                    0, 4,
                    f"  - {f['name']}: {f['value']:.4f} (contribution: {f['contribution']:+.4f})",
                    ln=True,
                )

        pdf.ln(3)
        pdf.set_draw_color(220, 220, 220)
        pdf.line(10, pdf.get_y(), 200, pdf.get_y())
        pdf.ln(3)

    # Save PDF
    pdf_path = os.path.join(settings.report_dir, f"aml_report_run_{run_id}.pdf")
    pdf.output(pdf_path)
    logger.info("PDF report saved to %s", pdf_path)

    return pdf_path
