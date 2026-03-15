"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { getRun, getReportUrl, RunData, CustomerData } from "@/lib/api";
import RiskDistribution from "@/components/RiskDistribution";
import FlaggedTable, { hasGroundTruth } from "@/components/FlaggedTable";
import ShapWaterfall from "@/components/ShapWaterfall";
import { getRiskFactorInfo, RISK_FACTOR_GLOSSARY } from "@/lib/riskFactors";

function formatVolume(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

export default function DashboardPage() {
  const params = useParams();
  const runId = Number(params.runId);

  const [data, setData] = useState<RunData | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerData | null>(null);
  const [showValidation, setShowValidation] = useState(false);
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
          {data.completed_at && new Date(data.completed_at).toLocaleString()}
        </p>
      </div>

      <div className="dashboard-stats">
        <div className="stat-card">
          <div className="stat-label">Total Accounts</div>
          <div className="stat-value" style={{ color: "#ffffff" }}>
            {data.total_accounts?.toLocaleString()}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Flagged Accounts</div>
          <div className="stat-value danger">
            {data.flagged_count}
          </div>
        </div>
        {data.precision_at_top_003 != null ? (
          <div className="stat-card">
            <div className="stat-label">Precision @ top 3%</div>
            <div className="stat-value success">
              {(data.precision_at_top_003 * 100).toFixed(1)}%
            </div>
          </div>
        ) : (
          <div className="stat-card">
            <div className="stat-label">Model AUC</div>
            <div className="stat-value success">
              {data.model_auc?.toFixed(4)}
            </div>
          </div>
        )}
        <div className="stat-card">
          <div className="stat-label">Report</div>
          <a
            href={getReportUrl(data.id)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
            style={{ marginTop: 4 }}>
            Download PDF
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

        <div className="card portfolio-risk-card">
          <div className="card-title">Portfolio Risk</div>
          {data.portfolio_risk != null && (data.portfolio_risk.transaction_count != null || (data.portfolio_risk.total_volume ?? 0) > 0) ? (
            <div className="portfolio-risk">
              {(data.portfolio_risk.total_volume ?? 0) > 0 && (
                <div className="portfolio-risk-chart">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: "Rest", value: (data.portfolio_risk.total_volume ?? 0) - (data.portfolio_risk.flagged_volume ?? 0) },
                          { name: "Flagged", value: data.portfolio_risk.flagged_volume ?? 0 },
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={58}
                        outerRadius={85}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                        label={({ cx, cy, index }) =>
                          index === 0 && data.portfolio_risk ? (
                            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fill="var(--text-primary)" fontSize={20} fontWeight={600}>
                              <tspan x={cx} dy="-0.2em">{(data.portfolio_risk.flagged_pct ?? 0).toFixed(1)}%</tspan>
                              <tspan x={cx} dy="1.2em" fontSize={11} fill="var(--text-muted)">flagged</tspan>
                            </text>
                          ) : null
                        }
                        labelLine={false}
                      >
                        <Cell fill="var(--accent-emerald)" />
                        <Cell fill="var(--accent-rose)" />
                      </Pie>
                      <Tooltip
                        formatter={(value: unknown) => formatVolume(Number(value ?? 0))}
                        contentStyle={{
                          background: "var(--bg-secondary)",
                          border: "1px solid var(--border-subtle)",
                          borderRadius: 8,
                          color: "var(--text-primary)",
                          fontSize: 12,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="portfolio-risk-legend">
                <div className="portfolio-risk-row">
                  <span className="portfolio-risk-label">Transactions</span>
                  <span className="portfolio-risk-value">
                    {data.portfolio_risk.transaction_count != null ? data.portfolio_risk.transaction_count.toLocaleString() : "—"}
                  </span>
                </div>
                <div className="portfolio-risk-row">
                  <span className="portfolio-risk-label">Accounts</span>
                  <span className="portfolio-risk-value">{data.total_accounts?.toLocaleString() ?? "—"}</span>
                </div>
                {(data.portfolio_risk.total_volume ?? 0) > 0 && (
                  <>
                    <div className="portfolio-risk-row">
                      <span className="portfolio-risk-label">Total volume</span>
                      <span className="portfolio-risk-value">{formatVolume(data.portfolio_risk.total_volume ?? 0)}</span>
                    </div>
                    <div className="portfolio-risk-row">
                      <span className="portfolio-risk-label">Flagged volume</span>
                      <span className="portfolio-risk-value danger">{formatVolume(data.portfolio_risk.flagged_volume ?? 0)}</span>
                    </div>
                    <div className="portfolio-risk-row">
                      <span className="portfolio-risk-label">Flagged %</span>
                      <span className="portfolio-risk-value danger">{(data.portfolio_risk.flagged_pct ?? 0).toFixed(1)}%</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="portfolio-risk portfolio-risk-fallback">
              <div className="portfolio-risk-legend">
                <div className="portfolio-risk-row">
                  <span className="portfolio-risk-label">Accounts</span>
                  <span className="portfolio-risk-value">{data.total_accounts?.toLocaleString() ?? "—"}</span>
                </div>
              </div>
              <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 12 }}>No transaction volume data for this run. Upload runs with transactions and accounts to see portfolio risk and the donut chart.</p>
            </div>
          )}
        </div>
      </div>

      <div className="dashboard-full">
        <div className="card">
          <div className="card-title-row">
            <div className="card-title" style={{ marginBottom: 0 }}>
              Flagged Accounts ({data.customers.length})
            </div>
            {hasGroundTruth(data.customers) && (
              <label className="validation-toggle">
                <input
                  type="checkbox"
                  checked={showValidation}
                  onChange={(e) => setShowValidation(e.target.checked)}
                />
                Show validation
              </label>
            )}
          </div>
          <FlaggedTable
            customers={data.customers}
            onSelect={setSelectedCustomer}
            showValidation={showValidation}
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

            {selectedCustomer.top_features && selectedCustomer.top_features.length > 0 && (() => {
              const chartFeatures = [...selectedCustomer.top_features]
                .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
                .slice(0, 8);
              const chartNames = Array.from(new Set(chartFeatures.map((f) => f.name)));
              return (
                <div className="detail-section">
                  <div className="detail-section-title">Risk Factor Breakdown (SHAP)</div>
                  <ShapWaterfall features={selectedCustomer.top_features} />
                  <div className="risk-factor-info-box">
                    <div className="risk-factor-info-title">What these risk factors mean</div>
                    <p className="risk-factor-info-intro">
                      These metrics describe how the account moves money and how it sits in the transaction network. They explain why the model assigned a higher risk score.
                    </p>
                    <ul className="risk-factor-glossary-list">
                      {chartNames.map((name) => {
                        const info = getRiskFactorInfo(name);
                        return (
                          <li key={name}>
                            <strong>{info.label}</strong> — {info.description}
                          </li>
                        );
                      })}
                    </ul>
                    <details className="risk-factor-all-definitions">
                      <summary>View full glossary of risk factors</summary>
                      <ul className="risk-factor-glossary-list">
                        {Object.entries(RISK_FACTOR_GLOSSARY).map(([key, { label, description }]) => (
                          <li key={key}>
                            <strong>{label}</strong> — {description}
                          </li>
                        ))}
                      </ul>
                    </details>
                  </div>
                </div>
              );
            })()}

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
