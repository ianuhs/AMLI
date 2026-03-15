/**
 * Human-readable labels and explanations for SHAP risk factors.
 * Shown in the Risk Factor Breakdown info box so users understand what each metric means.
 */
export interface RiskFactorEntry {
  label: string;
  description: string;
}

export const RISK_FACTOR_GLOSSARY: Record<string, RiskFactorEntry> = {
  counterparty_ratio: {
    label: "Counterparty ratio",
    description:
      "Ratio of unique recipients to unique senders. High values can indicate layering — moving funds through many different accounts to obscure the trail.",
  },
  avg_received: {
    label: "Avg received",
    description:
      "Average amount received per transaction. Unusually high averages can signal placement of illicit funds into the account.",
  },
  betweenness: {
    label: "Betweenness centrality",
    description:
      "How often this account sits on the shortest path between other accounts in the network. High values suggest the account acts as a hub or intermediary, which is common in laundering chains.",
  },
  avg_daily_tx: {
    label: "Avg daily transactions",
    description:
      "Average number of transactions per day. Spikes or high averages can indicate structuring (breaking up activity to avoid thresholds) or rapid movement of funds.",
  },
  community_size: {
    label: "Community size",
    description:
      "Size of the cluster of accounts this one transacts with. Very large or very tight communities can be a sign of organized layering or funneling.",
  },
  unique_recipients: {
    label: "Unique recipients",
    description:
      "Number of distinct accounts that received money from this account. Many recipients can indicate layering — spreading funds across many parties to obscure origin.",
  },
  sent_recv_ratio: {
    label: "Sent / received ratio",
    description:
      "Ratio of total money sent to total money received. Strong imbalances (e.g. mostly sending or mostly receiving) can indicate pass-through or funneling behavior.",
  },
  pagerank: {
    label: "PageRank",
    description:
      "Network importance score: how central this account is to money flow. High scores mean the account is a key node in the network, which may warrant closer review.",
  },
  sar_tx_count: {
    label: "SAR-linked transaction count",
    description:
      "Number of this account's transactions that are tied to prior Suspicious Activity Reports. A direct indicator of involvement in previously flagged activity.",
  },
  sar_tx_ratio: {
    label: "SAR-linked transaction share",
    description:
      "Share of this account's transactions that are linked to SARs. A high ratio raises suspicion even if the absolute count is modest.",
  },
  round_amt_ratio: {
    label: "Round-amount ratio",
    description:
      "Share of transactions in round amounts (e.g. $10,000, $5,000). Round amounts are a common structuring signal because they suggest intentional rounding.",
  },
  structuring_count: {
    label: "Structuring-style count",
    description:
      "Count of transactions just below common reporting thresholds (e.g. $9,000–$9,999). A classic indicator of structuring to avoid triggering reports.",
  },
  reciprocal_tx_ratio: {
    label: "Reciprocal transaction ratio",
    description:
      "Share of transactions that are part of back-and-forth flows with another account (A→B and B→A). Can indicate circular layering or round-tripping.",
  },
  max_daily_tx: {
    label: "Max daily transactions",
    description:
      "Maximum number of transactions in a single day. Bursts of activity can indicate rapid movement of funds or structuring across many small transactions.",
  },
  total_sent: {
    label: "Total sent",
    description:
      "Total amount sent by this account. High volume or unusual patterns relative to peer accounts can contribute to risk.",
  },
  total_received: {
    label: "Total received",
    description:
      "Total amount received by this account. High volume or unusual patterns can contribute to risk.",
  },
  in_degree: {
    label: "In-degree",
    description:
      "Number of distinct accounts that sent money to this account. Many senders can indicate funneling — funds being concentrated into one place.",
  },
  out_degree: {
    label: "Out-degree",
    description:
      "Number of distinct accounts that received money from this account. Many recipients can indicate layering or distribution.",
  },
  unique_senders: {
    label: "Unique senders",
    description: "Number of distinct accounts that sent money to this account.",
  },
  tx_count_total: {
    label: "Total transaction count",
    description: "Total number of transactions. Activity level is used together with other patterns to assess risk.",
  },
  log_total_sent: {
    label: "Log total sent",
    description: "Log-scale measure of total sent, used in the model to capture volume while reducing outlier impact.",
  },
  is_individual: {
    label: "Entity type (individual)",
    description: "Whether the account holder is an individual (1) or organization (0). Entity type can affect expected behavior.",
  },
};

/** Get label and description for a feature key; falls back to formatted name if unknown. */
export function getRiskFactorInfo(featureKey: string): RiskFactorEntry {
  const normalized = featureKey.trim().toLowerCase();
  if (RISK_FACTOR_GLOSSARY[normalized]) {
    return RISK_FACTOR_GLOSSARY[normalized];
  }
  const label = normalized.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    label,
    description: "Behavioral or network indicator that contributed to this account’s risk score.",
  };
}
