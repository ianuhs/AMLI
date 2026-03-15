# AMLI — AI-Powered Anti-Money Laundering Detection

Detect suspicious financial activity using machine learning, graph analytics, and generative AI. Upload transaction data and receive an interactive risk dashboard with explainable results and compliance-ready PDF reports.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 14 · TypeScript · Recharts |
| **ML Backend** | FastAPI · Python 3.11 |
| **Graph Analytics** | python-igraph (PageRank, betweenness, Louvain) |
| **Tabular ML** | LightGBM · SHAP |
| **Generative AI** | IBM watsonx.ai (Granite 3-3-8b-instruct) |
| **Database** | PostgreSQL 16 |
| **PDF Reports** | fpdf2 |
| **Containerization** | Docker Compose |

## How It Works

```
CSV Upload → Feature Engineering → LightGBM → SHAP → watsonx LLM → Dashboard + PDF
```

1. **Upload** transaction and account CSVs via the web interface
2. **Feature Engineering** — 20+ behavioral features (velocity, structuring, send/receive patterns) plus graph features (PageRank, centrality, community detection)
3. **LightGBM Classifier** — trained with class imbalance handling to score each account's risk (0–1)
4. **SHAP Explainability** — per-account feature contribution breakdown
5. **IBM watsonx.ai** — converts SHAP output into plain-language compliance summaries
6. **Dashboard** — interactive risk distribution chart, flagged accounts table, SHAP waterfall charts, network graph visualization
7. **PDF Report** — downloadable compliance report with executive summary and per-account analysis

## Prerequisites

- **Docker Desktop** (recommended) — [download](https://www.docker.com/products/docker-desktop/)
- **OR** for local development:
  - Node.js 18+
  - Python 3.11+
  - PostgreSQL 16 (or SQLite for quick testing)
- **IBM watsonx.ai credentials** (optional — app works without them using fallback summaries)

## Quick Start (Docker)

### 1. Clone and configure

```bash
git clone <repo-url>
cd AMLI
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Required
POSTGRES_USER=aml
POSTGRES_PASSWORD=amlpass
POSTGRES_DB=amldb

# Optional — IBM watsonx.ai (leave blank for fallback summaries)
WATSONX_API_KEY=your_api_key_here
WATSONX_PROJECT_ID=your_project_id_here
WATSONX_URL=https://us-south.ml.cloud.ibm.com
```

### 2. Start the application

```bash
docker compose up --build
```

This starts 3 services:
- **PostgreSQL** on port 5432
- **FastAPI backend** on port 8000
- **Next.js frontend** on port 3000

### 3. Open the app

Navigate to **http://localhost:3000** and upload your CSV files.

## Quick Start (Local — No Docker)

### 1. Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

pip install -r requirements.txt
```

Set environment variables (or create a `.env` file in the `backend/` directory):

```bash
set DATABASE_URL=postgresql://aml:amlpass@localhost:5432/amldb
set WATSONX_API_KEY=your_key
set WATSONX_PROJECT_ID=your_project_id
set WATSONX_URL=https://us-south.ml.cloud.ibm.com
```

Start the backend:

```bash
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000**.

## Uploading Data

The app expects CSV files matching the [AMLSim](https://github.com/IBM/AMLSim) output format:

| File | Required | Description |
|------|----------|-------------|
| `transactions.csv` | ✅ | Transaction records (sender, receiver, amount, type, timestamp) |
| `accounts.csv` | ✅ | Account info (ID, type, initial deposit) |
| `alert_accounts.csv` | Optional | Ground truth — suspicious account labels |
| `alert_transactions.csv` | Optional | Ground truth — suspicious transaction labels |
| `accountMapping.csv` | Optional | Account-to-customer mapping |
| `individuals.csv` | Optional | Individual entity profiles |
| `organizations.csv` | Optional | Organization entity profiles |

Sample data is included in `data/run_50K_5M/`.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/upload` | Upload CSV files and start pipeline |
| `GET` | `/api/runs` | List all pipeline runs |
| `GET` | `/api/runs/{id}` | Get run results (flagged customers, charts, graph) |
| `GET` | `/api/reports/{id}/download` | Download PDF report |
| `GET` | `/api/health` | Health check |

## IBM watsonx.ai Setup

1. Create an IBM Cloud account at [cloud.ibm.com](https://cloud.ibm.com)
2. Provision **watsonx.ai** from the catalog
3. Create a new project in watsonx.ai
4. Get your **API Key** from IBM Cloud → Manage → Access → API Keys
5. Get your **Project ID** from the watsonx.ai project settings (Manage tab → General)
6. Your **Region URL** depends on where you signed up:
   - Dallas: `https://us-south.ml.cloud.ibm.com`
   - Frankfurt: `https://eu-de.ml.cloud.ibm.com`
   - Tokyo: `https://jp-tok.ml.cloud.ibm.com`

> **Note:** The Lite plan may require manually provisioning "watsonx.ai Runtime" from the IBM Cloud catalog and associating it with your project.

## Project Structure

```
AMLI/
├── docker-compose.yml
├── .env.example
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py                # FastAPI entry point
│       ├── config.py              # Environment config
│       ├── database.py            # SQLAlchemy setup
│       ├── models.py              # DB models
│       ├── schemas.py             # API schemas
│       ├── pipeline.py            # ML pipeline orchestrator
│       ├── routers/               # API endpoints
│       │   ├── upload.py
│       │   ├── runs.py
│       │   └── reports.py
│       └── services/              # ML pipeline services
│           ├── ingestion.py       # CSV loading
│           ├── features.py        # Tabular features
│           ├── graph.py           # Graph features (igraph)
│           ├── model.py           # LightGBM
│           ├── explainer.py       # SHAP
│           ├── llm.py             # watsonx.ai
│           └── pdf.py             # PDF reports
├── frontend/
│   ├── Dockerfile
│   └── src/
│       ├── app/
│       │   ├── page.tsx           # Upload page
│       │   └── dashboard/[runId]/
│       │       └── page.tsx       # Results dashboard
│       ├── components/
│       │   ├── RiskDistribution.tsx
│       │   ├── FlaggedTable.tsx
│       │   ├── ShapWaterfall.tsx
│       │   └── NetworkGraph.tsx
│       └── lib/
│           └── api.ts             # API client
└── data/
    └── run_50K_5M/                # Sample AMLSim dataset
```

## License

MIT
