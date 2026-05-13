"use client";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// ── Card ─────────────────────────────────────────────────────────────────────
interface CardProps {
  title?: string;
  sub?: string;
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}
export function Card({ title, sub, children, className, hover = true }: CardProps) {
  return (
    <motion.div
      whileHover={hover ? { y: -2 } : undefined}
      transition={{ duration: 0.15 }}
      className={cn("rounded-2xl p-5 flex flex-col bg-white", className)}
      style={{ border: "1px solid #e2e8f0", boxShadow: "var(--card-shadow)" }}
      onMouseEnter={(e) => { if (hover) e.currentTarget.style.boxShadow = "var(--card-shadow-hover)"; }}
      onMouseLeave={(e) => { if (hover) e.currentTarget.style.boxShadow = "var(--card-shadow)"; }}
    >
      {(title || sub) && (
        <div className="mb-4">
          {title && <p className="text-sm font-semibold text-slate-700">{title}</p>}
          {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
      )}
      {children}
    </motion.div>
  );
}

// ── RiskBadge ─────────────────────────────────────────────────────────────────
export function RiskBadge({ score }: { score?: number }) {
  const val = score ?? 0;
  const style =
    val > 70
      ? { background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }
      : val > 40
      ? { background: "#fffbeb", color: "#d97706", border: "1px solid #fde68a" }
      : { background: "#f0fdf4", color: "#059669", border: "1px solid #bbf7d0" };

  return (
    <motion.span
      animate={val > 70 ? { scale: [1, 1.04, 1] } : {}}
      transition={val > 70 ? { duration: 2, repeat: Infinity } : {}}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={style}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: style.color }} />
      {val.toFixed(1)}
    </motion.span>
  );
}

// ── DecisionBadge ─────────────────────────────────────────────────────────────
const DECISION_STYLES: Record<string, React.CSSProperties> = {
  BLOCK:   { background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" },
  REVIEW:  { background: "#fffbeb", color: "#d97706", border: "1px solid #fde68a" },
  APPROVE: { background: "#f0fdf4", color: "#059669", border: "1px solid #bbf7d0" },
};
export function DecisionBadge({ decision }: { decision?: string }) {
  const style = DECISION_STYLES[decision ?? ""] ?? DECISION_STYLES.REVIEW;
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold" style={style}>
      {decision ?? "—"}
    </span>
  );
}

// ── SectionTitle ──────────────────────────────────────────────────────────────
export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3">
      {children}
    </p>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}
