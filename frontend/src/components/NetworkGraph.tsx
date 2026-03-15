"use client";

import { useRef, useEffect, useMemo } from "react";
import { GraphData } from "@/lib/api";

interface Props {
  data: GraphData;
}

interface SimNode {
  id: string;
  label: string;
  risk_score: number;
  alert_type?: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

const COLORS: Record<string, string> = {
  fan_in: "#f43f5e",
  fan_out: "#f59e0b",
  cycle: "#8b5cf6",
  default: "#6366f1",
};

export default function NetworkGraph({ data }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const nodes = useMemo<SimNode[]>(() => {
    return data.nodes.map((n, i) => ({
      ...n,
      x: 200 + Math.cos((2 * Math.PI * i) / data.nodes.length) * 120 + Math.random() * 40,
      y: 160 + Math.sin((2 * Math.PI * i) / data.nodes.length) * 120 + Math.random() * 40,
      vx: 0,
      vy: 0,
    }));
  }, [data.nodes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * 2;
    canvas.height = h * 2;
    ctx.scale(2, 2);

    const nodeMap = new Map<string, SimNode>();
    nodes.forEach((n) => nodeMap.set(n.id, n));

    for (let iter = 0; iter < 100; iter++) {
      const alpha = 0.3 * (1 - iter / 100);

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 800 / (dist * dist);
          nodes[i].vx -= (dx / dist) * force * alpha;
          nodes[i].vy -= (dy / dist) * force * alpha;
          nodes[j].vx += (dx / dist) * force * alpha;
          nodes[j].vy += (dy / dist) * force * alpha;
        }
      }

      for (const edge of data.edges) {
        const s = nodeMap.get(edge.source);
        const t = nodeMap.get(edge.target);
        if (!s || !t) continue;
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - 80) * 0.05 * alpha;
        s.vx += (dx / dist) * force;
        s.vy += (dy / dist) * force;
        t.vx -= (dx / dist) * force;
        t.vy -= (dy / dist) * force;
      }

      for (const n of nodes) {
        n.vx += (w / 2 - n.x) * 0.01 * alpha;
        n.vy += (h / 2 - n.y) * 0.01 * alpha;
        n.vx *= 0.6;
        n.vy *= 0.6;
        n.x += n.vx;
        n.y += n.vy;
        n.x = Math.max(30, Math.min(w - 30, n.x));
        n.y = Math.max(30, Math.min(h - 30, n.y));
      }
    }

    ctx.clearRect(0, 0, w, h);

    for (const edge of data.edges) {
      const s = nodeMap.get(edge.source);
      const t = nodeMap.get(edge.target);
      if (!s || !t) continue;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(t.x, t.y);
      ctx.strokeStyle = "rgba(99, 102, 241, 0.2)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    for (const n of nodes) {
      const color = COLORS[n.alert_type || "default"] || COLORS.default;
      const radius = 6 + n.risk_score * 10;

      ctx.beginPath();
      ctx.arc(n.x, n.y, radius + 4, 0, Math.PI * 2);
      ctx.fillStyle = color + "33";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      ctx.fillStyle = "#e2e8f0";
      ctx.font = "10px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(n.label.slice(0, 12), n.x, n.y + radius + 14);
    }
  }, [nodes, data.edges]);

  return (
    <canvas
      ref={canvasRef}
      className="network-canvas"
      style={{ width: "100%", height: 320 }}
    />
  );
}
