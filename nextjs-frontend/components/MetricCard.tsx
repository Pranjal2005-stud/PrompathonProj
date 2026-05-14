"use client";
import { memo } from "react";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/primitives";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MetricCardProps {
  type?: string;
  title: string;
  value: number;
  sub?: string;
  loading?: boolean;
  prefix?: string;
  trend?: "up" | "down" | "neutral";
}

const MetricCard = memo(function MetricCard({
  title, value, sub, loading, prefix, trend = "neutral",
}: MetricCardProps) {
  if (loading) return <Skeleton className="rounded-xl h-20" />;

  const formatted = prefix
    ? `${prefix}${value >= 1_00_00_000
        ? `${(value / 1_00_00_000).toFixed(1)}Cr`
        : value >= 1_00_000
        ? `${(value / 1_00_000).toFixed(1)}L`
        : value.toLocaleString("en-IN")}`
    : value.toLocaleString();

  const isSaved = title.toLowerCase().includes("saved");
  const isInvoices = title.toLowerCase().includes("invoice");
  const isRisk = title.toLowerCase().includes("risk") || title.toLowerCase().includes("fraud");
  const isReview = title.toLowerCase().includes("review");

  // Determine accent colors
  const getAccentStyle = () => {
    if (isSaved)    return { accent: "#22c55e", bg: "#f0fdf4", border: "#bbf7d0" };
    if (isRisk)     return { accent: "#dc2626", bg: "#fef2f2", border: "#fecaca" };
    if (isReview)   return { accent: "#d97706", bg: "#fffbeb", border: "#fde68a" };
    if (isInvoices) return { accent: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" };
    return { accent: "#64748b", bg: "#f8fafc", border: "#e2e8f0" };
  };

  const accentStyle = getAccentStyle();
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor = trend === "up" ? "#22c55e" : trend === "down" ? "#dc2626" : "#94a3b8";

  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: "0 8px 24px rgba(37,99,235,0.15)" }}
      transition={{ duration: 0.2 }}
      className="rounded-xl p-4 cursor-default relative overflow-hidden"
      style={{
        background: accentStyle.bg,
        border: `1px solid ${accentStyle.border}`,
      }}
    >
      {/* Left accent border */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
        style={{ background: accentStyle.accent }}
      />

      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: accentStyle.accent }}>
          {title}
        </p>
        {trend !== "neutral" && (
          <TrendIcon size={12} style={{ color: trendColor }} className={trend === "up" ? "animate-bounce" : ""} />
        )}
      </div>
      <p className="text-2xl font-bold text-slate-800 mt-1 font-mono">{formatted}</p>
      {sub && <p className="text-xs mt-1" style={{ color: "#94a3b8" }}>{sub}</p>}
    </motion.div>
  );
});

export default MetricCard;
