"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { RiskBin } from "@/lib/api";

const HIGH_RISK_MIN = 0.97;
/** Scale down bars below HIGH_RISK_MIN so the top-risk bin stands out (curve down). */
function displayCount(entry: RiskBin): number {
  if (entry.min >= HIGH_RISK_MIN) return entry.count;
  return Math.pow(entry.count, 0.55);
}

interface Props {
  data: RiskBin[];
}

export default function RiskDistribution({ data }: Props) {
  const chartData = data.map((entry) => ({
    ...entry,
    displayCount: displayCount(entry),
  }));

  function getBarColor(min: number): string {
    if (min >= 0.7) return "#f43f5e";
    if (min >= 0.5) return "#f59e0b";
    if (min >= 0.3) return "#06b6d4";
    return "#6366f1";
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 24, right: 32, bottom: 16, left: 0 }}>
        <XAxis
          dataKey="range"
          tick={{ fill: "#64748b", fontSize: 10 }}
          axisLine={{ stroke: "#1e293b" }}
          tickLine={false}
          angle={-45}
          textAnchor="end"
          height={60}
        />
        <YAxis
          tick={{ fill: "#64748b", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            background: "#1a1f35",
            border: "1px solid rgba(99, 102, 241, 0.3)",
            borderRadius: 8,
            color: "#f1f5f9",
            fontSize: 13,
          }}
          labelStyle={{ color: "#94a3b8" }}
          itemStyle={{ color: "#ffffff" }}
          formatter={(_, __, item) => {
            const payload = item?.payload as RiskBin | undefined;
            return [payload ? `${payload.count}` : "", "Accounts"];
          }}
          cursor={{ fill: "rgba(99, 102, 241, 0.08)" }}
        />
        <Bar dataKey="displayCount" radius={[4, 4, 0, 0]} name="Accounts">
          {chartData.map((entry, i) => (
            <Cell key={i} fill={getBarColor(entry.min)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
