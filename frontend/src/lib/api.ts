const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function uploadFiles(formData: FormData) {
  const res = await fetch(`${API_BASE}/api/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
  return res.json();
}

export async function getRuns() {
  const res = await fetch(`${API_BASE}/api/runs`);
  if (!res.ok) throw new Error(`Failed to fetch runs: ${res.statusText}`);
  return res.json();
}

export async function getRun(runId: number) {
  const res = await fetch(`${API_BASE}/api/runs/${runId}`);
  if (!res.ok) throw new Error(`Failed to fetch run: ${res.statusText}`);
  return res.json();
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
  graph_data?: GraphData;
}

export interface CustomerData {
  id: number;
  acct_id: number;
  display_name?: string;
  entity_type?: string;
  risk_score: number;
  is_flagged: boolean;
  alert_type?: string;
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

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphNode {
  id: string;
  label: string;
  risk_score: number;
  alert_type?: string;
  in_degree: number;
  out_degree: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
}
