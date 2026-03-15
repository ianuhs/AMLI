# AMLI — AI-Powered Anti-Money Laundering Intelligence

Detect suspicious financial activity using machine learning, graph analytics, and generative AI. Upload transaction data and receive an interactive risk dashboard with explainable results and a compliance-ready PDF report.

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
