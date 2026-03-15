import logging
from app.config import settings

logger = logging.getLogger(__name__)


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
    feature_lines = "\n".join(
        f"  - {f['name']}: {f['value']:.4f} (SHAP contribution: {f['contribution']:+.4f})"
        for f in top_features[:5]
    )

    alert_info = f"\nAlert type: {alert_type}" if alert_type else ""

    return f"""You are a financial compliance analyst. Write a concise 2-3 sentence summary explaining why the following bank customer account was flagged for potential money laundering. Use professional compliance language suitable for a Suspicious Activity Report (SAR).

Customer Account: {acct_id}
Risk Score: {risk_score:.4f}{alert_info}

Top risk-contributing features (from SHAP analysis):
{feature_lines}

Write a clear, factual summary focusing on the specific behavioral indicators that triggered the flag. Do not speculate beyond the data provided."""


def _fallback_summary(acct_id: int, risk_score: float, top_features: list, alert_type: str = None) -> str:
    """Generate a template-based summary when watsonx is unavailable."""
    top = top_features[0] if top_features else None
    alert_str = f" Pattern type: {alert_type}." if alert_type else ""

    if top:
        return (
            f"Account {acct_id} was flagged with a risk score of {risk_score:.2f}.{alert_str} "
            f"The primary risk indicator is {top['name']} "
            f"(value: {top['value']:.4f}, SHAP contribution: {top['contribution']:+.4f}). "
            f"Further investigation is recommended."
        )
    return f"Account {acct_id} was flagged with a risk score of {risk_score:.2f}.{alert_str} Further investigation is recommended."
