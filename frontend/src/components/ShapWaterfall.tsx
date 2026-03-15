"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import { FeatureContribution } from "@/lib/api";
import { getRiskFactorInfo } from "@/lib/riskFactors";

interface Props {
  features: FeatureContribution[];
}

export default function ShapWaterfall({ features }: Props) {
  const top = [...features]
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, 8)
    .reverse();

  const chartData = top.map((f) => ({
    name: getRiskFactorInfo(f.name).label,
    contribution: Number(f.contribution.toFixed(4)),
    fullName: f.name,
    value: f.value,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
      >
        <XAxis
          type="number"
          tick={{ fill: "#64748b", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fill: "#94a3b8", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={160}
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
          itemStyle={{ color: "#f1f5f9" }}
        />
        <ReferenceLine x={0} stroke="#334155" />
        <Bar dataKey="contribution" radius={[0, 4, 4, 0]}>
          {chartData.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.contribution >= 0 ? "#f43f5e" : "#10b981"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
