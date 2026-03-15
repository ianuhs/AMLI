"use client";

import { useState } from "react";
import { CustomerData } from "@/lib/api";

interface Props {
  customers: CustomerData[];
  onSelect: (customer: CustomerData) => void;
  showValidation?: boolean;
}

type SortKey = "risk_score" | "acct_id" | "total_sent" | "total_received" | "tx_count";

export function hasGroundTruth(customers: CustomerData[]): boolean {
  return customers.some(
    (c) => c.ground_truth_flagged === true || c.ground_truth_flagged === false
  );
}

export default function FlaggedTable({ customers, onSelect, showValidation = false }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("risk_score");
  const [sortAsc, setSortAsc] = useState(false);

  const groundTruth = hasGroundTruth(customers);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  }

  const sorted = [...customers].sort((a, b) => {
    const va = a[sortKey] ?? 0;
    const vb = b[sortKey] ?? 0;
    return sortAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
  });

  function riskClass(score: number): string {
    if (score >= 0.8) return "critical";
    if (score >= 0.6) return "high";
    return "medium";
  }

  const sortIndicator = (key: SortKey) =>
    sortKey === key ? (sortAsc ? " ↑" : " ↓") : "";

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="data-table">
        <thead>
          <tr>
            <th className={sortKey === "acct_id" ? "sorted" : ""} onClick={() => handleSort("acct_id")}>
              Account{sortIndicator("acct_id")}
            </th>
            <th className={sortKey === "risk_score" ? "sorted" : ""} onClick={() => handleSort("risk_score")}>
              Risk Score{sortIndicator("risk_score")}
            </th>
            <th>
              Alert Type{" "}
              <span className="info-icon-wrap">
                <span className="info-icon">i</span>
                <span className="info-tooltip">
                  <strong>fan_in</strong> — Unusually many counterparties sending funds into this account (funneling).<br />
                  <strong>fan_out</strong> — Unusually many counterparties receiving funds from this account (layering).<br />
                  <strong>cycle</strong> — Money flows in closed loops between a small group of accounts (circular layering).<br />
                  <strong>other</strong> — Network pattern that did not match the above but still triggered an alert.
                </span>
              </span>
            </th>
            <th>Entity</th>
            {showValidation && groundTruth && <th>Validation</th>}
            <th className={sortKey === "total_sent" ? "sorted" : ""} onClick={() => handleSort("total_sent")}>
              Total Sent{sortIndicator("total_sent")}
            </th>
            <th className={sortKey === "total_received" ? "sorted" : ""} onClick={() => handleSort("total_received")}>
              Total Received{sortIndicator("total_received")}
            </th>
            <th className={sortKey === "tx_count" ? "sorted" : ""} onClick={() => handleSort("tx_count")}>
              Transactions{sortIndicator("tx_count")}
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((c) => (
            <tr key={c.id} onClick={() => onSelect(c)}>
              <td style={{ fontWeight: 600 }}>{c.acct_id}</td>
              <td>
                <span className={`risk-badge ${riskClass(c.risk_score)}`}>
                  ● {c.risk_score.toFixed(4)}
                </span>
              </td>
              <td>
                {c.alert_type ? (
                  <span className="alert-badge">{c.alert_type}</span>
                ) : (
                  <span style={{ color: "var(--text-muted)" }}>—</span>
                )}
              </td>
              <td>{c.entity_type || "—"}</td>
              {showValidation && groundTruth && (
                <td>
                  {c.ground_truth_flagged === true ? (
                    <span style={{ color: "var(--accent-green, #22c55e)", fontWeight: 500 }}>True positive</span>
                  ) : c.ground_truth_flagged === false ? (
                    <span style={{ color: "var(--accent-rose, #f43f5e)", fontWeight: 500 }}>False positive</span>
                  ) : (
                    <span style={{ color: "var(--text-muted)" }}>—</span>
                  )}
                </td>
              )}
              <td>${c.total_sent?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || "0"}</td>
              <td>${c.total_received?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || "0"}</td>
              <td>{c.tx_count?.toLocaleString() || "0"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
