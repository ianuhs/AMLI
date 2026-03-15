"use client";

import { useState } from "react";
import { CustomerData } from "@/lib/api";

interface Props {
  customers: CustomerData[];
  onSelect: (customer: CustomerData) => void;
}

type SortKey = "risk_score" | "acct_id" | "total_sent" | "total_received" | "tx_count";

export default function FlaggedTable({ customers, onSelect }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("risk_score");
  const [sortAsc, setSortAsc] = useState(false);

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
            <th>Alert Type</th>
            <th>Entity</th>
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
