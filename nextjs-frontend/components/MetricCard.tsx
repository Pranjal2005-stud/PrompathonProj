"use client";
import { memo } from "react";
import { motion } from "framer-motion";
import { FileText, ShieldX, Building2, DollarSign } from "lucide-react";
import { useCountUp } from "@/hooks/useCountUp";
import { Skeleton } from "@/components/ui/primitives";

const CFG = {
  invoices: {
    icon: FileText,
    iconColor: "#2563eb",
    iconBg: "#dbeafe",
    accent: "#2563eb",
    border: "#bfdbfe",
    bg: "#f0f6ff",
  },
  blocked: {
    icon: ShieldX,
    iconColor: "#dc2626",
    iconBg: "#fee2e2",
    accent: "#dc2626",
    border: "#fecaca",
    bg: "#fff5f5",
  },
  vendors: {
    icon: Building2,
    iconColor: "#d97706",
    iconBg: "#fef3c7",
    accent: "#d97706",
    border: "#fde68a",
    bg: "#fffbeb",
  },
  saved: {
    icon: DollarSign,
    iconColor: "#059669",
    iconBg: "#d1fae5",
    accent: "#059669",
    border: "#a7f3d0",
    bg: "#f0fdf8",
  },
} as const;

interface MetricCardProps {
  type: keyof typeof CFG;
  title: string;
  value: number;
  sub?: string;
  loading?: boolean;
  prefix?: string;
}

const MetricCard = memo(function MetricCard({
  type, title, value, sub, loading, prefix,
}: MetricCardProps) {
  const cfg = CFG[type];
  const Icon = cfg.icon;
  const displayed = useCountUp(value);

  if (loading) return <Skeleton className="rounded-2xl h-32" />;

  // Format large numbers to avoid overflow
  const formatted = prefix
    ? `${prefix}${displayed >= 1_00_00_000
        ? `${(displayed / 1_00_00_000).toFixed(1)}Cr`
        : displayed >= 1_00_000
        ? `${(displayed / 1_00_000).toFixed(1)}L`
        : displayed.toLocaleString("en-IN")}`
    : displayed.toLocaleString();

  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: `0 12px 32px ${cfg.accent}18` }}
      transition={{ duration: 0.18 }}
      className="rounded-2xl p-5 cursor-default overflow-hidden"
      style={{
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        boxShadow: `0 1px 4px ${cfg.accent}10`,
      }}
    >
      {/* Icon + title row */}
      <div className="flex items-center gap-2.5 mb-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: cfg.iconBg }}
        >
          <Icon size={16} style={{ color: cfg.iconColor }} />
        </div>
        <p className="text-xs font-semibold leading-tight" style={{ color: cfg.iconColor }}>
          {title}
        </p>
      </div>

      {/* Value — clamp to one line, never overflow */}
      <p
        className="text-2xl font-bold leading-none tracking-tight truncate"
        style={{ color: "#0f172a" }}
      >
        {formatted}
      </p>

      {sub && (
        <p className="text-xs mt-1.5 truncate" style={{ color: "#64748b" }}>
          {sub}
        </p>
      )}
    </motion.div>
  );
});

export default MetricCard;
