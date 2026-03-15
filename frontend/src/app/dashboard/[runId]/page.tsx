"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { getRun, getReportUrl, RunData, CustomerData } from "@/lib/api";
import RiskDistribution from "@/components/RiskDistribution";
import FlaggedTable from "@/components/FlaggedTable";
import ShapWaterfall from "@/components/ShapWaterfall";
import NetworkGraph from "@/components/NetworkGraph";

export default function DashboardPage() {
  const params = useParams();
  const runId = Number(params.runId);

  const [data, setData] = useState<RunData | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const result = await getRun(runId);
      setData(result);
      return result.status;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load data");
      return "error";
    }
  }, [runId]);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    let mounted = true;

    async function poll() {
      const status = await fetchData();
      if (mounted && (status === "pending" || status === "processing")) {
        timeout = setTimeout(poll, 2000);
      }
    }

    poll();
    return () => { mounted = false; clearTimeout(timeout); };
  }, [fetchData]);

  if (error) {
    return (
      <div className="loading-container">
        <p style={{ color: "var(--accent-rose)", fontSize: 18 }}>⚠️ {error}</p>
        <a href="/" className="btn btn-secondary">← Back to Upload</a>
      </div>
    );
  }

  if (!data || data.status === "pending" || data.status === "processing") {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <p className="loading-text">Analyzing transactions...</p>
        <p className="loading-status">{data?.status || "connecting"}</p>
        <div className="progress-bar">
          <div className="progress-bar-fill" />
        </div>
      </div>
    );
  }

  if (data.status === "error") {
    return (
      <div className="loading-container">
        <p style={{ color: "var(--accent-rose)", fontSize: 18 }}>
          ⚠️ Pipeline failed: {data.error_message}
        </p>
        <a href="/" className="btn btn-secondary">← Try Again</a>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Risk Analysis Results</h1>
        <p>
          Run #{data.id} — {data.filename} —{" "}
          {data.completed_at && new Date(data.completed_at).toLocaleString()}
        </p>
      </div>

      <div className="dashboard-stats">
        <div className="stat-card">
          <div className="stat-label">Total Accounts</div>
          <div className="stat-value info">
            {data.total_accounts?.toLocaleString()}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Flagged Accounts</div>
          <div className="stat-value danger">
            {data.flagged_count}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Model AUC</div>
          <div className="stat-value success">
            {data.model_auc?.toFixed(4)}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Report</div>
          <a
            href={getReportUrl(data.id)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
            style={{ marginTop: 4 }}
          >
            📄 Download PDF
          </a>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="card">
          <div className="card-title">Risk Score Distribution</div>
          {data.risk_distribution && (
            <RiskDistribution data={data.risk_distribution} />
          )}
        </div>

        <div className="card">
          <div className="card-title">Flagged Account Network</div>
          {data.graph_data && <NetworkGraph data={data.graph_data} />}
        </div>
      </div>

      <div className="dashboard-full">
        <div className="card">
          <div className="card-title">
            Flagged Accounts ({data.customers.length})
          </div>
          <FlaggedTable
            customers={data.customers}
            onSelect={setSelectedCustomer}
          />
        </div>
      </div>

      {selectedCustomer && (
        <div className="customer-detail">
          <div className="detail-header">
            <h2>Account {selectedCustomer.acct_id}</h2>
            <button
              className="detail-close"
              onClick={() => setSelectedCustomer(null)}
            >
              ✕
            </button>
          </div>
          <div className="detail-body">
            <div className="detail-section">
              <div className="detail-section-title">Key Metrics</div>
              <div className="detail-metrics">
                <div className="detail-metric">
                  <div className="detail-metric-label">Risk Score</div>
                  <div className="detail-metric-value" style={{ color: "var(--accent-rose)" }}>
                    {selectedCustomer.risk_score.toFixed(4)}
                  </div>
                </div>
                <div className="detail-metric">
                  <div className="detail-metric-label">Alert Type</div>
                  <div className="detail-metric-value">
                    {selectedCustomer.alert_type || "N/A"}
                  </div>
                </div>
                <div className="detail-metric">
                  <div className="detail-metric-label">Total Sent</div>
                  <div className="detail-metric-value">
                    ${selectedCustomer.total_sent?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || "0"}
                  </div>
                </div>
                <div className="detail-metric">
                  <div className="detail-metric-label">Total Received</div>
                  <div className="detail-metric-value">
                    ${selectedCustomer.total_received?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || "0"}
                  </div>
                </div>
                <div className="detail-metric">
                  <div className="detail-metric-label">Transaction Count</div>
                  <div className="detail-metric-value">
                    {selectedCustomer.tx_count?.toLocaleString() || "0"}
                  </div>
                </div>
                <div className="detail-metric">
                  <div className="detail-metric-label">PageRank</div>
                  <div className="detail-metric-value">
                    {selectedCustomer.pagerank?.toFixed(6) || "0"}
                  </div>
                </div>
              </div>
            </div>

            {selectedCustomer.top_features && selectedCustomer.top_features.length > 0 && (
              <div className="detail-section">
                <div className="detail-section-title">Risk Factor Breakdown (SHAP)</div>
                <ShapWaterfall features={selectedCustomer.top_features} />
              </div>
            )}

            {selectedCustomer.llm_summary && (
              <div className="detail-section">
                <div className="detail-section-title">AI Compliance Summary</div>
                <div className="llm-summary">
                  {selectedCustomer.llm_summary}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
