import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql://aml:amlpass@localhost:5432/amldb"

    # IBM watsonx.ai
    watsonx_api_key: str = ""
    watsonx_project_id: str = ""
    watsonx_url: str = "https://us-south.ml.cloud.ibm.com"
    watsonx_model_id: str = "ibm/granite-3-3-8b-instruct"

    # Paths
    upload_dir: str = "/app/uploads"
    report_dir: str = "/app/reports"
    data_dir: str = "/app/data"

    # Pipeline
    risk_threshold: float = 0.5
    max_llm_accounts: int = 50  # max flagged accounts to summarize via LLM

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()

# Ensure directories exist
os.makedirs(settings.upload_dir, exist_ok=True)
os.makedirs(settings.report_dir, exist_ok=True)
