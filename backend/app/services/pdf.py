import os
import logging
from datetime import datetime
from fpdf import FPDF

from app.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Helvetica in FPDF only supports latin-1.  Sanitise any Unicode to ASCII.
# ---------------------------------------------------------------------------
_UNICODE_MAP = {
    "\u2014": " - ",
    "\u2013": "-",
    "\u2018": "'",
    "\u2019": "'",
    "\u201c": '"',
    "\u201d": '"',
    "\u2026": "...",
}


def _s(text) -> str:
    """Sanitise *text* so it only contains characters Helvetica can render."""
    if text is None:
        return ""
    text = str(text)
    for uni, ascii_val in _UNICODE_MAP.items():
        text = text.replace(uni, ascii_val)
    return "".join(c if ord(c) < 128 else "?" for c in text)


# ---------------------------------------------------------------------------
# Colours
# ---------------------------------------------------------------------------
_CLR_DARK   = (30, 30, 30)
_CLR_MID    = (100, 100, 100)
_CLR_LIGHT  = (180, 180, 180)
_CLR_ACCENT = (84, 185, 72)
_CLR_RED    = (248, 81, 73)
_CLR_BG     = (245, 245, 245)
_CLR_WHITE  = (255, 255, 255)

# Page geometry
_LM = 15          # left margin
_RM = 15          # right margin
_PW = 210         # A4 width
_CW = _PW - _LM - _RM   # content width


class AMLReport(FPDF):

    _show_title_header = True  # only on page 1

    def header(self):
        if self._show_title_header and self.page_no() == 1:
            self.set_y(12)
            self.set_font("Helvetica", "B", 18)
            self.set_text_color(*_CLR_DARK)
            self.cell(0, 10, "AMLI Risk Analysis Report", align="C", ln=True)
            self.set_font("Helvetica", "", 9)
            self.set_text_color(*_CLR_MID)
            self.cell(0, 6, f"Generated {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}", align="C", ln=True)
            self.ln(2)
            self.set_draw_color(*_CLR_ACCENT)
            self.set_line_width(0.6)
            self.line(_LM, self.get_y(), _PW - _RM, self.get_y())
            self.set_line_width(0.2)
            self.ln(6)
        else:
            self.set_y(10)

    def footer(self):
        self.set_y(-12)
        self.set_font("Helvetica", "", 7)
        self.set_text_color(*_CLR_LIGHT)
        self.cell(0, 8, f"Page {self.page_no()}/{{nb}}   |   AMLI Confidential", align="C")

    # ---- helpers ----------------------------------------------------------

    def section_title(self, label: str):
        self.set_font("Helvetica", "B", 12)
        self.set_text_color(*_CLR_DARK)
        self.cell(0, 8, label, ln=True)
        self.ln(1)

    def kv_line(self, key: str, value: str):
        self.set_font("Helvetica", "", 9)
        self.set_text_color(*_CLR_MID)
        self.cell(55, 5, key, ln=False)
        self.set_text_color(*_CLR_DARK)
        self.cell(0, 5, _s(value), ln=True)

    def thin_rule(self):
        self.set_draw_color(*_CLR_LIGHT)
        self.set_line_width(0.15)
        y = self.get_y()
        self.line(_LM, y, _PW - _RM, y)
        self.ln(4)

    def ensure_space(self, mm: float = 50):
        if self.get_y() > 297 - mm:
            self.add_page()


# ---------------------------------------------------------------------------
# Report generation
# ---------------------------------------------------------------------------
def generate_pdf_report(
    run_id: int,
    total_accounts: int,
    flagged_count: int,
    model_auc: float,
    flagged_customers: list,
) -> str:
    pdf = AMLReport()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.set_left_margin(_LM)
    pdf.set_right_margin(_RM)
    pdf.add_page()

    # --- Executive Summary ------------------------------------------------
    pdf.section_title("Executive Summary")

    pdf.kv_line("Run ID", str(run_id))
    pdf.kv_line("Total accounts analysed", f"{total_accounts:,}")
    pdf.kv_line("Accounts flagged", str(flagged_count))
    if total_accounts > 0:
        pdf.kv_line("Flag rate", f"{100 * flagged_count / total_accounts:.2f}%")
    pdf.kv_line("Model AUC", f"{model_auc:.4f}" if model_auc else "N/A")
    pdf.ln(6)

    # --- Flagged Accounts Table -------------------------------------------
    pdf.section_title("Flagged Accounts Overview")

    col_w = [22, 22, 22, 26, _CW - 22 - 22 - 22 - 26]
    headers = ["Account", "Score", "Alert", "Entity", "Primary Risk Factor"]

    # header row
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_fill_color(*_CLR_BG)
    pdf.set_text_color(*_CLR_DARK)
    for i, h in enumerate(headers):
        pdf.cell(col_w[i], 6, h, border=0, fill=True, align="C" if i < 4 else "L")
    pdf.ln()
    pdf.thin_rule()

    # data rows
    pdf.set_font("Helvetica", "", 8)
    for idx, cust in enumerate(flagged_customers):
        pdf.ensure_space(12)

        top_factor = ""
        if cust.get("top_features"):
            f = cust["top_features"][0]
            top_factor = f"{f['name']} ({f['contribution']:+.3f})"

        bg = idx % 2 == 0
        if bg:
            pdf.set_fill_color(250, 250, 250)

        vals = [
            str(cust.get("acct_id", "")),
            f"{cust.get('risk_score', 0):.4f}",
            _s(str(cust.get("alert_type", "-"))),
            _s(str(cust.get("entity_type", "-"))),
            _s(top_factor),
        ]
        for i, v in enumerate(vals):
            pdf.cell(col_w[i], 5.5, v, fill=bg, align="C" if i < 4 else "L")
        pdf.ln()

    pdf.ln(6)

    # --- Detailed Customer Analysis ---------------------------------------
    pdf.add_page()
    pdf.section_title("Detailed Account Analysis")
    pdf.ln(2)

    for cust in flagged_customers:
        pdf.ensure_space(55)

        acct_id = cust.get("acct_id", "?")
        score = cust.get("risk_score", 0)
        alert = cust.get("alert_type") or "-"
        entity = cust.get("entity_type") or "-"

        # account header bar
        pdf.set_fill_color(*_CLR_BG)
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(*_CLR_DARK)
        pdf.cell(_CW, 7, _s(f"  Account {acct_id}"), fill=True, ln=True)
        pdf.ln(1)

        # meta line
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(*_CLR_MID)

        score_color = _CLR_RED if score >= 0.8 else _CLR_DARK
        pdf.set_text_color(*_CLR_MID)
        pdf.cell(20, 5, "Risk Score: ", ln=False)
        pdf.set_text_color(*score_color)
        pdf.set_font("Helvetica", "B", 9)
        pdf.cell(20, 5, f"{score:.4f}", ln=False)

        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(*_CLR_MID)
        pdf.cell(25, 5, f"    Alert: {_s(alert)}", ln=False)
        pdf.cell(0, 5, f"    Entity: {_s(entity)}", ln=True)
        pdf.ln(2)

        # AI compliance summary
        summary = cust.get("llm_summary")
        if summary:
            pdf.set_draw_color(*_CLR_ACCENT)
            pdf.set_line_width(0.5)
            x0 = pdf.get_x()
            y0 = pdf.get_y()
            pdf.set_x(x0 + 3)
            pdf.set_font("Helvetica", "I", 8.5)
            pdf.set_text_color(*_CLR_MID)
            pdf.multi_cell(_CW - 6, 4.5, _s(summary))
            y1 = pdf.get_y()
            pdf.line(x0, y0, x0, y1)
            pdf.set_line_width(0.2)
            pdf.ln(2)

        # risk indicators
        features = cust.get("top_features") or []
        if features:
            pdf.set_font("Helvetica", "B", 8)
            pdf.set_text_color(*_CLR_DARK)
            pdf.cell(0, 5, "Key Risk Indicators", ln=True)
            pdf.set_font("Helvetica", "", 8)
            pdf.set_text_color(*_CLR_MID)
            for f in features[:5]:
                name = f["name"].replace("_", " ").title()
                val = f["value"]
                contrib = f["contribution"]
                direction = "increases" if contrib > 0 else "decreases"
                line = f"  {name} = {val:.4f}  ({direction} risk by {abs(contrib):.4f})"
                pdf.cell(0, 4.5, _s(line), ln=True)
            pdf.ln(2)

        pdf.thin_rule()

    # --- Save -------------------------------------------------------------
    pdf_path = os.path.join(settings.report_dir, f"aml_report_run_{run_id}.pdf")
    pdf.output(pdf_path)
    logger.info("PDF report saved to %s", pdf_path)
    return pdf_path
