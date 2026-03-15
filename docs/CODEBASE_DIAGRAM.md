# AML Sentinel — Codebase Architecture

## High-level system diagram

```mermaid
flowchart TB
    subgraph Client["🖥️ Client"]
        Browser[Browser]
    end

    subgraph Frontend["Frontend (Next.js 14 + TypeScript)"]
        UploadPage["page.tsx\nUpload CSV files"]
        DashboardPage["dashboard/[runId]/page.tsx\nResults dashboard"]
        RiskDist["RiskDistribution.tsx"]
        FlaggedTable["FlaggedTable.tsx"]
        ShapWaterfall["ShapWaterfall.tsx"]
        NetworkGraph["NetworkGraph.tsx"]
        API["lib/api.ts\nAPI client"]
    end

    subgraph Backend["Backend (FastAPI)"]
        Main["main.py\nFastAPI app"]
        UploadRouter["routers/upload.py\nPOST /api/upload"]
        RunsRouter["routers/runs.py\nGET /api/runs, /api/runs/{id}"]
        ReportsRouter["routers/reports.py\nGET /api/reports/{id}/download"]
        Pipeline["pipeline.py\nOrchestrator"]
    end

    subgraph Services["Pipeline services"]
        Ingestion["ingestion.py\nCSV load + normalize"]
        Features["features.py\nTabular features"]
        Graph["graph.py\nigraph: PageRank, centrality"]
        Model["model.py\nLightGBM predict"]
        Explainer["explainer.py\nSHAP"]
        LLM["llm.py\nwatsonx.ai summaries"]
        PDF["pdf.py\nfpdf2 reports"]
    end

    subgraph Data["Data layer"]
        DB[(PostgreSQL\nRun, Customer, Report)]
        UploadDir[Upload directory\nCSV files]
        ModelFiles[Pre-trained models]
    end

    Browser --> UploadPage
    Browser --> DashboardPage
    UploadPage --> API
    DashboardPage --> API
    API --> UploadRouter
    API --> RunsRouter
    API --> ReportsRouter

    UploadRouter --> Pipeline
    UploadRouter --> DB
    UploadRouter --> UploadDir
    RunsRouter --> DB
    ReportsRouter --> DB

    Pipeline --> Ingestion
    Ingestion --> Features
    Features --> Graph
    Graph --> Model
    Model --> Explainer
    Explainer --> LLM
    LLM --> PDF
    PDF --> DB

    Pipeline --> DB
    Ingestion --> UploadDir
    Model --> ModelFiles
```

## Pipeline data flow

```mermaid
flowchart LR
    A[CSV Upload] --> B[ingestion.py\nload + normalize]
    B --> C[features.py\n20+ behavioral features]
    C --> D[graph.py\nPageRank, betweenness,\nLouvain communities]
    D --> E[model.py\nLightGBM risk scores]
    E --> F[explainer.py\nSHAP per account]
    F --> G[llm.py\nwatsonx plain-language\nsummaries]
    G --> H[pdf.py\nCompliance PDF]
    H --> I[DB + Dashboard]
```

## Backend module dependency graph

```mermaid
flowchart TB
    main["main.py"]
    config["config.py"]
    database["database.py"]
    models["models.py"]
    schemas["schemas.py"]

    main --> database
    main --> upload
    main --> runs
    main --> reports

    subgraph Routers
        upload["upload.py"]
        runs["runs.py"]
        reports["reports.py"]
    end

    upload --> database
    upload --> models
    upload --> schemas
    upload --> config
    upload --> pipeline

    runs --> database
    runs --> models
    runs --> schemas

    reports --> database
    reports --> models

    pipeline["pipeline.py"] --> database
    pipeline --> models
    pipeline --> ingestion
    pipeline --> features
    pipeline --> graph
    pipeline --> model
    pipeline --> explainer
    pipeline --> llm
    pipeline --> pdf
    pipeline --> config

    subgraph services
        ingestion["ingestion.py"]
        features["features.py"]
        graph["graph.py"]
        model["model.py"]
        explainer["explainer.py"]
        llm["llm.py"]
        pdf["pdf.py"]
    end
```

## Database schema

```mermaid
erDiagram
    Run ||--o{ Customer : has
    Run ||--o| Report : has

    Run {
        int id PK
        string filename
        string status
        string error_message
        int total_accounts
        int flagged_count
        float model_auc
        datetime created_at
        datetime completed_at
    }

    Customer {
        int id PK
        int run_id FK
        int acct_id
        string display_name
        string entity_type
        float risk_score
        bool is_flagged
        string alert_type
        json shap_values
        json top_features
        text llm_summary
        float total_sent
        float total_received
        int tx_count
        int in_degree
        int out_degree
        float pagerank
    }

    Report {
        int id PK
        int run_id FK
        string pdf_path
        datetime created_at
    }
```

## Frontend structure

```mermaid
flowchart TB
    subgraph app["app/"]
        layout["layout.tsx"]
        page["page.tsx\nUpload form"]
        dashboard["dashboard/[runId]/page.tsx\nRun results"]
    end

    subgraph components["components/"]
        RiskDistribution["RiskDistribution.tsx\nRisk histogram"]
        FlaggedTable["FlaggedTable.tsx\nFlagged accounts table"]
        ShapWaterfall["ShapWaterfall.tsx\nSHAP feature contributions"]
        NetworkGraph["NetworkGraph.tsx\nTransaction graph"]
    end

    subgraph lib["lib/"]
        api["api.ts\nuploadFiles, getRuns,\ngetRun, getReportUrl"]
    end

    layout --> page
    layout --> dashboard
    page --> api
    dashboard --> api
    dashboard --> RiskDistribution
    dashboard --> FlaggedTable
    dashboard --> ShapWaterfall
    dashboard --> NetworkGraph
```

## File tree (AMLI core)

```
AMLI/
├── docker-compose.yml
├── .env.example
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI entry, CORS, routers
│   │   ├── config.py        # settings (DB, upload_dir, risk_threshold, watsonx)
│   │   ├── database.py      # SQLAlchemy engine, SessionLocal, Base
│   │   ├── models.py        # Run, Customer, Report
│   │   ├── schemas.py       # Pydantic (UploadResponse, etc.)
│   │   ├── pipeline.py      # run_pipeline() → ingestion→features→graph→model→explainer→llm→pdf
│   │   ├── routers/
│   │   │   ├── upload.py    # POST /api/upload → save files, background run_pipeline
│   │   │   ├── runs.py      # GET /api/runs, GET /api/runs/{id}
│   │   │   └── reports.py   # GET /api/reports/{id}/download
│   │   └── services/
│   │       ├── ingestion.py # load_csv_files, normalize_columns
│   │       ├── features.py  # compute_tabular_features
│   │       ├── graph.py     # compute_graph_features (igraph)
│   │       ├── model.py     # load_pretrained_model, predict_risk_scores
│   │       ├── explainer.py # compute_shap_values
│   │       ├── llm.py       # generate_llm_summary (watsonx)
│   │       └── pdf.py       # generate_pdf_report
│   └── scripts/
│       └── train.py         # Model training (offline)
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── page.tsx
│       │   └── dashboard/[runId]/page.tsx
│       ├── components/
│       │   ├── RiskDistribution.tsx
│       │   ├── FlaggedTable.tsx
│       │   ├── ShapWaterfall.tsx
│       │   └── NetworkGraph.tsx
│       └── lib/
│           └── api.ts
└── data/
    └── run_50K_5M/          # Sample AMLSim CSVs
```

---

*Generated from the AMLI codebase. View this file in a Markdown viewer that supports Mermaid (e.g. VS Code, GitHub) to see the diagrams.*
