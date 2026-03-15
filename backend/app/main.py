from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app.routers import upload, runs, reports

# Create all tables on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AML Detection API",
    description="Anti-Money Laundering detection pipeline with LightGBM, SHAP, and IBM watsonx.ai",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router, prefix="/api", tags=["upload"])
app.include_router(runs.router, prefix="/api", tags=["runs"])
app.include_router(reports.router, prefix="/api", tags=["reports"])


@app.get("/api/health")
def health_check():
    return {"status": "ok"}
