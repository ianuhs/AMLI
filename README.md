# AMLI — AI-Powered Anti-Money Laundering Intelligence

Detect suspicious financial activity using machine learning, graph analytics, and generative AI. Upload transaction data and receive an interactive risk dashboard with explainable results and a compliance-ready PDF report.

Project made for GenAI Genesis 2026 Hackathon. Check out the [devpost!](https://devpost.com/software/amli-anti-money-laundering-intelligence)

![alt text](AMLI_Diagram.png)
---

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [How It Works](#how-it-works)
4. [Project Structure](#project-structure)
5. [Data Requirements](#data-requirements)
6. [Quick Start (Docker)](#quick-start-docker)
7. [Environment Variables](#environment-variables)
8. [Dashboard Features](#dashboard-features)
9. [Risk Factors Reference](#risk-factors-reference)
10. [Alert Types](#alert-types)
11. [PDF Report](#pdf-report)
12. [Test Datasets](#test-datasets)

---

## Overview

AMLI is a full-stack AML detection platform. Upload CSV files from your core banking system, and the pipeline automatically:

- Engineers 20+ behavioral and network features per account
- Trains and applies a LightGBM classifier to assign a risk score (0–1) to every account
- Explains each score using SHAP feature contributions
- Generates plain-language compliance summaries via IBM watsonx.ai (Granite)
- Presents results in an interactive dashboard with charts, a sortable flagged-accounts table, per-account SHAP waterfall charts, and a downloadable PDF report

Optional: upload a ground-truth `alert_accounts.csv` to enable **Precision @ top 3%** scoring and true/false positive labeling on the dashboard.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 14 · TypeScript · Recharts |
| **ML Backend** | FastAPI · Python 3.11 |
| **Graph Analytics** | python-igraph (PageRank, betweenness centrality, Louvain community detection) |
| **Tabular ML** | LightGBM · SHAP |
| **Generative AI** | IBM watsonx.ai — Granite 3-3-8b-instruct |
| **Database** | PostgreSQL 16 |
| **PDF Reports** | fpdf2 |
| **Containerization** | Docker Compose |

---

## How It Works

```
CSV Upload
    ↓
Feature Engineering (tabular + graph)
    ↓
LightGBM Classifier  →  Risk Score (0–1) per account
    ↓
SHAP Explainer  →  Top contributing factors per account
    ↓
IBM watsonx.ai  →  Plain-language compliance summary per flagged account
    ↓
Interactive Dashboard  +  PDF Report
```

### Pipeline Steps

1. **Ingestion** — CSVs are uploaded, normalised (column aliases handled automatically), and stored for the run.
2. **Feature Engineering** — Per-account behavioral features are computed from transactions (velocity, structuring signals, SAR-linked ratios, round-amount ratios, reciprocal flows) and network features from the transaction graph (PageRank, betweenness centrality, community size, in/out degree).
3. **LightGBM Classifier** — Trained with class-imbalance handling using scale_pos_weight. Outputs a probability score for each account.
4. **SHAP Explainability** — The top 8–10 feature contributions are computed for every flagged account.
5. **LLM Summaries** — IBM watsonx.ai converts the SHAP output into a 2–4 sentence compliance summary in plain English, suitable for inclusion in a SAR. Falls back to a template-based summary if watsonx is not configured.
6. **Results stored** — All customer records, scores, and summaries are persisted in PostgreSQL.
7. **Dashboard & PDF** — The frontend polls for completion and renders results. A PDF report is generated server-side.

---

## Project Structure

```
AMLI/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app entry point
│   │   ├── config.py            # Settings (env vars)
│   │   ├── models.py            # SQLAlchemy ORM models
│   │   ├── schemas.py           # Pydantic request/response schemas
│   │   ├── database.py          # DB session factory
│   │   ├── pipeline.py          # End-to-end ML pipeline orchestration
│   │   ├── routers/
│   │   │   ├── upload.py        # POST /api/upload
│   │   │   ├── runs.py          # GET /api/runs, /api/runs/{id}
│   │   │   └── reports.py       # GET /api/reports/{id}/download
│   │   └── services/
│   │       ├── ingestion.py     # CSV loading and column normalisation
│   │       ├── features.py      # Tabular feature engineering
│   │       ├── graph.py         # Graph feature engineering (igraph)
│   │       ├── model.py         # LightGBM training and inference
│   │       ├── explainer.py     # SHAP explanation computation
│   │       ├── llm.py           # watsonx.ai / fallback LLM summaries
│   │       └── pdf.py           # PDF report generation (fpdf2)
│   ├── models/                  # Persisted LightGBM model files
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx         # Landing page (upload + schema docs)
│   │   │   ├── dashboard/[runId]/page.tsx  # Run dashboard
│   │   │   └── globals.css      # Global styles
│   │   ├── components/
│   │   │   ├── RiskDistribution.tsx   # Risk score histogram
│   │   │   ├── FlaggedTable.tsx       # Sortable flagged accounts table
│   │   │   ├── ShapWaterfall.tsx      # SHAP horizontal bar chart
│   │   │   └── FlaggedTable.tsx
│   │   └── lib/
│   │       ├── api.ts           # API client + TypeScript types
│   │       └── riskFactors.ts   # Risk factor glossary (labels + descriptions)
│   └── Dockerfile
├── data/
│   └── test_sets/               # Sample datasets (set1, set2, set3)
│       └── setN/
│           ├── transactions.csv
│           ├── accounts.csv
│           └── alert_accounts.csv
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Data Requirements

### `transactions.csv` — Required

| Column | Description |
|---|---|
| `tran_id` | Unique transaction identifier |
| `orig_acct` | Sending account ID |
| `bene_acct` | Receiving account ID |
| `tx_type` | Transaction type (TRANSFER, PAYMENT, DEPOSIT, WITHDRAWAL, DEBIT, CREDIT) |
| `base_amt` | Transaction amount in USD |
| `tran_timestamp` | Timestamp in ISO 8601 format (YYYY-MM-DDTHH:MM:SSZ) |

Column aliases are handled automatically (e.g. `amount` → `base_amt`, `type` → `tx_type`).

### `accounts.csv` — Required

| Column | Description |
|---|---|
| `acct_id` | Unique numeric account identifier — must match `orig_acct`/`bene_acct` in transactions |

Additional columns (name, entity type, status, etc.) are accepted and used where available but are not required.

### `alert_accounts.csv` — Optional (validation only)

| Column | Description |
|---|---|
| `acct_id` | Account ID of a known-suspicious account (ground truth) |

When provided, the dashboard shows:
- **Precision @ top 3%** — precision among accounts with risk score ≥ 0.97
- **True / False positive** labels in the flagged accounts table

---

## Quick Start (Docker)

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine + Compose)
- (Optional) IBM watsonx.ai credentials for AI compliance summaries

### 1. Clone and configure

```bash
git clone https://github.com/your-org/AMLI.git
cd AMLI
cp .env.example .env
# Edit .env and add your watsonx credentials (optional)
```

### 2. Start all services

```bash
docker compose up --build
```

This starts:
- **PostgreSQL** on port 5432
- **FastAPI backend** on port 8000
- **Next.js frontend** on port 3000

### 3. Open the app

Navigate to [http://localhost:3000](http://localhost:3000).

### 4. Upload data

Drag and drop your CSV files (or use the test datasets in `data/test_sets/`) and click **Analyze Transactions**. Results appear automatically when the pipeline completes.

### Stopping

```bash
docker compose down          # stop containers, keep data
docker compose down -v       # stop containers and wipe database
```

---

## Environment Variables

Copy `.env.example` to `.env` and configure:

```env
# PostgreSQL
POSTGRES_USER=aml
POSTGRES_PASSWORD=amlpass
POSTGRES_DB=amldb

# Backend database connection (used inside Docker network)
DATABASE_URL=postgresql://aml:amlpass@postgres:5432/amldb

# Frontend API base URL (optional — defaults to http://localhost:8000)
# NEXT_PUBLIC_API_URL=http://localhost:8000

# IBM watsonx.ai (optional — fallback summaries used if not set)
WATSONX_API_KEY=your_api_key
WATSONX_PROJECT_ID=your_project_id
WATSONX_URL=https://ca-tor.ml.cloud.ibm.com
WATSONX_MODEL_ID=ibm/granite-3-3-8b-instruct
```

#### Optional backend settings (set in `.env` or environment)

| Variable | Default | Description |
|---|---|---|
| `RISK_THRESHOLD` | `0.5` | Minimum score to flag an account |
| `UPLOAD_DIR` | `/app/uploads` | Where uploaded CSVs are stored |
| `REPORT_DIR` | `/app/reports` | Where generated PDFs are saved |

> **watsonx.ai is optional.** If `WATSONX_API_KEY` is not set, AI compliance summaries fall back to a template-based plain-English description using the same risk factor glossary.

---

## Dashboard Features

### Top Stats Row
- **Total Accounts** — number of accounts analyzed
- **Flagged Accounts** — accounts above the risk threshold
- **Precision @ top 3%** (when ground truth provided) or **Model AUC** (otherwise)
- **Download PDF** — generates the compliance report

### Risk Score Distribution
A histogram of all account risk scores. Bars below 0.97 are displayed on a compressed scale so the high-risk tail is visually distinct.

### Portfolio Risk
A donut chart showing the split of total transaction volume between flagged and unflagged accounts, plus a summary of:
- Total transactions and accounts
- Total volume, flagged volume, and percentage at risk

### Flagged Accounts Table
Sortable by risk score, account ID, sent/received volume, and transaction count. When ground truth is available, a "Show validation" toggle adds True/False positive labels. Clicking a row opens the account detail panel.

### Account Detail Panel
- **Key Metrics** — risk score, alert type, volumes, transaction count, PageRank
- **Risk Factor Breakdown (SHAP)** — horizontal bar chart of the 8 most influential features, with explanations below
- **AI Compliance Summary** — plain-language paragraph generated by IBM watsonx.ai (Granite)

---

## Risk Factors Reference

| Factor | What it measures |
|---|---|
| **SAR-linked transaction count** | Number of transactions tied to prior Suspicious Activity Reports |
| **Counterparty ratio** | Ratio of unique recipients to unique senders — high values suggest layering |
| **Betweenness centrality** | How often the account sits on shortest paths in the network — key intermediary indicator |
| **Avg daily transactions** | Average daily activity — spikes can indicate structuring |
| **Round-amount ratio** | Share of transactions in round amounts — classic structuring signal |
| **Structuring-style count** | Transactions just below reporting thresholds ($9,000–$9,999) |
| **Sent / received ratio** | Imbalance between outgoing and incoming volume |
| **PageRank** | Network centrality — how important the account is to overall money flow |
| **Community size** | Size of the account's transaction cluster |
| **Unique recipients** | Number of distinct accounts receiving money |
| **Reciprocal transaction ratio** | Back-and-forth flows (A→B and B→A) — circular layering signal |
| **Max daily transactions** | Largest single-day transaction burst |

A full glossary is available in the Risk Factor Breakdown section of any account detail panel.

---

## Alert Types

Alert types are assigned based on network topology patterns detected in the transaction graph:

| Type | Description |
|---|---|
| **fan_in** | Unusually many counterparties sending funds *into* this account — indicates funneling |
| **fan_out** | Unusually many counterparties receiving funds *from* this account — indicates layering |
| **cycle** | Money flows in closed loops between a small group of accounts — circular layering |
| **other** | Network pattern that triggered an alert but does not fit the above categories |

---

## PDF Report

Clicking **Download PDF** generates a structured compliance report containing:

1. **Executive Summary** — run metadata, total accounts, flag rate, model AUC
2. **Flagged Accounts Overview** — summary table with risk scores, alert types, and primary risk factor per account
3. **Detailed Account Analysis** — for each flagged account:
   - Risk score (highlighted red for scores ≥ 0.8) and alert type
   - AI compliance summary (plain English, suitable for SAR narrative)
   - Top 5 risk indicators with values and direction of contribution

The PDF is generated server-side using fpdf2 and stored in the `reports/` volume.

---

## Test Datasets

Three synthetic datasets are included in `data/test_sets/`, generated with AMLSim. Each set contains `transactions.csv`, `accounts.csv`, and `alert_accounts.csv` with known ground-truth labels for validation.

| Dataset | Accounts | Transactions |
|---|---|---|
| `set1` | ~500 | ~40,000 |
| `set2` | ~250 | ~20,000 |
| `set3` | ~250 | ~20,000 |

These datasets include fan_in, fan_out, and cycle laundering patterns and are suitable for end-to-end testing including Precision @ top 3% validation.

---

## AMLSim

The `AMLSim/` directory contains the simulation configuration and scripts used to generate the training datasets. [AMLSim](https://github.com/IBM/AMLSim) is a multi-agent simulator developed by IBM Research that produces synthetic transaction networks with realistic money-laundering patterns (fan-in, fan-out, cycle, scatter-gather, etc.) and corresponding ground-truth alert labels.

If you use the AMLSim-generated data in your work, please cite:

```bibtex
@misc{AMLSim,
  author       = {Toyotaro Suzumura and Hiroki Kanezashi},
  title        = {{Anti-Money Laundering Datasets}: {InPlusLab} Anti-Money Laundering Datasets},
  howpublished = {\url{http://github.com/IBM/AMLSim/}},
  year         = {2021}
}
```

> Suzumura, T. & Kanezashi, H. — *Scalable Graph Learning for Anti-Money Laundering: A First Look*. arXiv:1812.00076  
> Pareja, A. et al. — *EvolveGCN: Evolving Graph Convolutional Networks for Dynamic Graphs*. arXiv:1902.10191
