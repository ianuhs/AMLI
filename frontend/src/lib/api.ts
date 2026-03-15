const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function handleFetchError(err: unknown, context: string): never {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg === "Failed to fetch" || msg.includes("NetworkError") || msg.includes("Load failed")) {
    throw new Error(
      `Cannot reach the API at ${API_BASE}. Make sure the backend is running (e.g. \`uvicorn app.main:app --port 8000\` in the backend folder).`
    );
  }
  throw err instanceof Error ? err : new Error(`${context}: ${msg}`);
}

export async function uploadFiles(formData: FormData) {
  try {
    const res = await fetch(`${API_BASE}/api/upload`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
    return res.json();
  } catch (e) {
    handleFetchError(e, "Upload failed");
  }
}

export async function getRuns() {
  try {
    const res = await fetch(`${API_BASE}/api/runs`);
    if (!res.ok) throw new Error(`Failed to fetch runs: ${res.statusText}`);
    return res.json();
  } catch (e) {
    handleFetchError(e, "Failed to fetch runs");
  }
}

export async function getRun(runId: number) {
  try {
    const res = await fetch(`${API_BASE}/api/runs/${runId}`);
    if (!res.ok) throw new Error(`Failed to fetch run: ${res.statusText}`);
    return res.json();
  } catch (e) {
    handleFetchError(e, "Failed to fetch run");
  }
}

export function getReportUrl(runId: number) {
  return `${API_BASE}/api/reports/${runId}/download`;
}

export interface RunData {
  id: number;
  filename: string;
  status: string;
  error_message?: string;
  total_accounts?: number;
  flagged_count?: number;
  model_auc?: number;
  created_at: string;
  completed_at?: string;
  customers: CustomerData[];
  risk_distribution?: RiskBin[];
  portfolio_risk?: PortfolioRisk;
  precision_at_top_003?: number | null;
}

export interface PortfolioRisk {
  total_volume: number;
  flagged_volume: number;
  flagged_pct: number;
  transaction_count?: number;
}

export interface CustomerData {
  id: number;
  acct_id: number;
  display_name?: string;
  entity_type?: string;
  risk_score: number;
  is_flagged: boolean;
  alert_type?: string;
  ground_truth_flagged?: boolean | null;
  top_features?: FeatureContribution[];
  llm_summary?: string;
  total_sent?: number;
  total_received?: number;
  tx_count?: number;
  in_degree?: number;
  out_degree?: number;
  pagerank?: number;
}

export interface FeatureContribution {
  name: string;
  value: number;
  contribution: number;
}

export interface RiskBin {
  range: string;
  count: number;
  min: number;
  max: number;
}

