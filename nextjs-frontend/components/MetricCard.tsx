"use client";
import { memo } from "react";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/primitives";

interface MetricCardProps {
  type?: string;
  title: string;
  value: number;
  sub?: string;
  loading?: boolean;
  prefix?: string;
}

const MetricCard = memo(function MetricCard({
  title, value, sub, loading, prefix,
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

  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: "0 8px 24px rgba(37,99,235,0.15)" }}
      transition={{ duration: 0.2 }}
      className="rounded-xl p-4 cursor-default"
      style={{
        background: isSaved
          ? "linear-gradient(135deg, #f0fdf4 0%, #d1fae5 100%)"
          : isInvoices
          ? "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)"
          : "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
        border: "1px solid",
        borderColor: isSaved ? "#86efac" : isInvoices ? "#93c5fd" : "#e2e8f0",
      }}
    >
      <p className="text-xs font-medium mb-1" style={{ color: isSaved ? "#059669" : isInvoices ? "#2563eb" : "#64748b" }}>
        {title}
      </p>
      <p className="text-xl font-bold text-slate-800">{formatted}</p>
      {sub && <p className="text-xs mt-1" style={{ color: "#94a3b8" }}>{sub}</p>}
    </motion.div>
  );
});

export default MetricCard;
