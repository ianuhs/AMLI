import logging
from app.config import settings

logger = logging.getLogger(__name__)

# Plain-language descriptions for compliance summaries and fallback. Key = feature name (as in SHAP).
FEATURE_DESCRIPTIONS = {
    "counterparty_ratio": "ratio of unique recipients to unique senders — high values can indicate layering (many counterparties)",
    "avg_received": "average amount received per transaction — unusually high averages can signal placement of illicit funds",
    "betweenness": "how often the account sits on shortest paths between others — high values suggest a hub or intermediary in the network",
    "avg_daily_tx": "average number of transactions per day — spikes or high averages can indicate structuring or rapid movement of funds",
    "community_size": "size of the account's transaction community — very large or very tight communities can be a laundering pattern",
    "unique_recipients": "number of distinct accounts that received money from this account — many recipients can indicate layering",
    "sent_recv_ratio": "ratio of total sent to total received — imbalances can indicate pass-through or funneling behavior",
    "pagerank": "network importance score — high scores mean the account is central to money flow and may be a key node",
    "sar_tx_count": "number of transactions linked to prior suspicious activity reports — direct indicator of SAR history",
    "sar_tx_ratio": "share of this account's transactions that are SAR-linked — high ratio raises suspicion",
    "round_amt_ratio": "share of transactions in round amounts (e.g. $10,000) — round amounts are a common structuring signal",
    "structuring_count": "count of transactions just below reporting thresholds (e.g. $9,000–$9,999) — classic structuring indicator",
    "reciprocal_tx_ratio": "share of transactions that are part of back-and-forth flows with another account — can indicate circular layering",
    "max_daily_tx": "maximum transactions in a single day — bursts can indicate rapid movement or structuring",
    "total_sent": "total amount sent — volume and pattern matter for risk",
    "total_received": "total amount received — volume and pattern matter for risk",
    "in_degree": "number of distinct senders to this account — many senders can indicate funneling",
    "out_degree": "number of distinct recipients from this account — many recipients can indicate layering",
    "unique_senders": "number of distinct accounts that sent money to this account",
    "tx_count_total": "total number of transactions — activity level",
    "log_total_sent": "log of total sent — used to capture volume in the model",
    "is_individual": "whether the account holder is an individual (1) or organization (0)",
}


def generate_llm_summary(acct_id: int, risk_score: float, top_features: list, alert_type: str = None) -> str:
    """
    Call IBM watsonx.ai Granite to generate a compliance-language summary
    for a flagged customer based on their SHAP feature contributions.
    """
    if not settings.watsonx_api_key:
        logger.warning("watsonx API key not configured, returning placeholder summary")
        return _fallback_summary(acct_id, risk_score, top_features, alert_type)

    try:
        from ibm_watsonx_ai.foundation_models import ModelInference
        from ibm_watsonx_ai import Credentials

        credentials = Credentials(
            url=settings.watsonx_url,
            api_key=settings.watsonx_api_key,
        )

        model = ModelInference(
            model_id=settings.watsonx_model_id,
            credentials=credentials,
            project_id=settings.watsonx_project_id,
        )

        prompt = _build_prompt(acct_id, risk_score, top_features, alert_type)

        response = model.generate_text(
            prompt=prompt,
            params={
                "max_new_tokens": 250,
                "temperature": 0.3,
                "top_p": 0.9,
                "repetition_penalty": 1.1,
            },
        )

        logger.info("LLM summary generated for account %d", acct_id)
        return response.strip()

    except Exception as e:
        logger.error("watsonx API call failed for account %d: %s", acct_id, str(e))
        return _fallback_summary(acct_id, risk_score, top_features, alert_type)


def _build_prompt(acct_id: int, risk_score: float, top_features: list, alert_type: str = None) -> str:
    """Build the prompt for compliance summary generation."""
    # Include each top feature with its plain-language meaning so the model can explain in natural language
    feature_lines = []
    for f in top_features[:5]:
        desc = FEATURE_DESCRIPTIONS.get(
            f["name"],
            "behavioral or network indicator that contributed to the risk score",
        )
        feature_lines.append(
            f"  - {f['name']} (value {f['value']:.2f}, positive contribution to risk): {desc}"
        )
    feature_block = "\n".join(feature_lines)

    alert_info = f" Alert pattern detected: {alert_type}." if alert_type else ""

    return f"""You are a financial compliance analyst. Write a short 2-4 sentence summary for a Suspicious Activity Report (SAR) explaining why this account was flagged. Use plain, professional language. Do NOT use technical terms like SHAP, feature names, or numbers from the data in your summary — instead explain what the behavior means in practice.

Account ID: {acct_id}
Risk score: {risk_score:.2f} (0-1 scale).{alert_info}

What drove the risk (explain these in plain language to the reader):
{feature_block}

Write a summary that a compliance officer can read and understand without knowing the model. For example, instead of "high sar_tx_count" say something like "the account has multiple transactions tied to prior suspicious activity reports." Focus on what the account did that is concerning, not on model internals."""


def _fallback_summary(acct_id: int, risk_score: float, top_features: list, alert_type: str = None) -> str:
    """Generate a natural-language summary when watsonx is unavailable."""
    alert_str = f" Alert pattern: {alert_type}." if alert_type else ""
    if not top_features:
        return (
            f"Account {acct_id} was flagged with a risk score of {risk_score:.2f}.{alert_str} "
            "Further investigation is recommended."
        )
    top = top_features[0]
    desc = FEATURE_DESCRIPTIONS.get(
        top["name"],
        "behavior that contributed to the elevated risk score",
    )
    return (
        f"Account {acct_id} was flagged with a risk score of {risk_score:.2f}.{alert_str} "
        f"The main driver is that {desc.capitalize()}. "
        "Further investigation is recommended."
    )
