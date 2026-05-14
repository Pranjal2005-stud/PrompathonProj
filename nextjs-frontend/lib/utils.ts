import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Invoice, AlertLevel, AISection } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getRiskColor(score: number) {
  if (score >= 65) return { color: "#dc2626", bg: "#fef2f2", border: "#fecaca" };
  if (score >= 35) return { color: "#d97706", bg: "#fffbeb", border: "#fde68a" };
  return { color: "#059669", bg: "#f0fdf4", border: "#bbf7d0" };
}

export function getHeatmapColor(score: number | null) {
  if (score === null || score === undefined)
    return { bg: "#f8fafc", text: "#94a3b8", border: "#e2e8f0" };
  if (score <= 15) return { bg: "#dcfce7", text: "#166534", border: "#bbf7d0" };
  if (score <= 30) return { bg: "#86efac", text: "#14532d", border: "#4ade80" };
  if (score <= 35) return { bg: "#22c55e", text: "#ffffff", border: "#16a34a" };
  if (score <= 45) return { bg: "#fed7aa", text: "#7c2d12", border: "#fb923c" };
  if (score <= 55) return { bg: "#f97316", text: "#ffffff", border: "#ea580c" };
  if (score <= 65) return { bg: "#c2410c", text: "#ffffff", border: "#9a3412" };
  if (score <= 75) return { bg: "#fca5a5", text: "#7f1d1d", border: "#f87171" };
  if (score <= 85) return { bg: "#ef4444", text: "#ffffff", border: "#dc2626" };
  return { bg: "#7f1d1d", text: "#ffffff", border: "#991b1b" };
}

export const SEVERITY_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  CRITICAL: { color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
  HIGH: { color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  MEDIUM: { color: "#ea580c", bg: "#fff7ed", border: "#fed7aa" },
  LOW: { color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
};

export const SEVERITY_ORDER: Record<string, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

export function getAlertSeverity(item: Invoice): AlertLevel {
  if (item.alert_level && item.alert_level !== "LOW") return item.alert_level;
  const r = item.risk_score ?? 0;
  if (r >= 85) return "CRITICAL";
  if (r >= 65) return "HIGH";
  if (r >= 45) return "MEDIUM";
  return "LOW";
}

export function getFraudCategory(item: Invoice): string | null {
  const ft = (item.fraud_type ?? "").toLowerCase();
  const fl = (item.rule_flags ?? item.reason ?? "").toLowerCase();
  if (ft.includes("split") || fl.includes("split")) return "Split Invoice";
  if (ft.includes("shell") || fl.includes("unknown")) return "Shell Vendor";
  if (ft.includes("overbill") || fl.includes("overbill")) return "Overbilling";
  if (ft.includes("duplicate") || fl.includes("duplicate")) return "Duplicate";
  if (ft.includes("overpay") || fl.includes("overpay")) return "Overpayment";
  if (ft.includes("threshold") || fl.includes("threshold")) return "Split Invoice";
  if (ft.includes("anomal") || ft.includes("coordinated")) return "Split Invoice";
  if (item.decision === "BLOCK" || item.decision === "REVIEW") return "Split Invoice";
  return null;
}

// ── AI Text Parser ────────────────────────────────────────────────────────────
export const RISK_KEYWORDS: Record<string, { color: string; bg: string; border: string }> = {
  "HIGH RISK": { color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
  CRITICAL: { color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
  BLOCK: { color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
  FRAUD: { color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
  "SPLIT INVOICE": { color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
  OVERBILLING: { color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  "SHELL VENDOR": { color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
  DUPLICATE: { color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  HIGH: { color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
  MEDIUM: { color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  LOW: { color: "#059669", bg: "#f0fdf4", border: "#bbf7d0" },
  APPROVE: { color: "#059669", bg: "#f0fdf4", border: "#bbf7d0" },
};

const SECTION_PATTERNS = [
  /^(AI Fraud Verdict|Verdict|Summary|Overview)/i,
  /^(Key Signals?|Signals?|Indicators?|Flags?|Evidence)/i,
  /^(Confidence|Confidence Score)/i,
  /^(Recommended Action|Recommendation|Action|Next Steps?)/i,
  /^(Risk Assessment|Assessment|Analysis)/i,
];

export function parseAIText(text: string): AISection[] {
  const sections: AISection[] = [];
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  let currentSection: string | null = null;
  let currentLines: string[] = [];

  lines.forEach((line) => {
    const isHeader =
      SECTION_PATTERNS.some((p) => p.test(line)) || /^#{1,3}\s/.test(line);
    if (isHeader) {
      if (currentSection !== null)
        sections.push({ title: currentSection, lines: currentLines });
      currentSection = line.replace(/^#{1,3}\s/, "");
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  });
  if (currentSection !== null)
    sections.push({ title: currentSection, lines: currentLines });
  if (sections.length === 0) sections.push({ title: null, lines });
  return sections;
}

export function buildCopilotContext(data: Invoice[]): string {
  if (!data.length) return "No invoices loaded yet.";
  const blocked = data.filter((d) => d.decision === "BLOCK").length;
  const review = data.filter((d) => d.decision === "REVIEW").length;
  const topRisk = [...data]
    .sort((a, b) => (b.risk_score ?? 0) - (a.risk_score ?? 0))
    .slice(0, 5)
    .map(
      (d) =>
        `${d.vendor_name} (risk: ${(d.risk_score ?? 0).toFixed(0)}, flags: ${d.reason ?? "anomaly"})`
    )
    .join("; ");
  const leakage = data
    .filter((d) => d.decision === "BLOCK")
    .reduce((s, d) => s + (d.invoice_amount ?? 0), 0);
  return `Total: ${data.length}. Blocked: ${blocked}. Review: ${review}. Leakage prevented: ₹${leakage.toLocaleString()}. Top risky: ${topRisk}.`;
}

export function exportCSV(data: Invoice[]) {
  const cols: (keyof Invoice)[] = [
    "invoice_id", "vendor_name", "invoice_amount", "risk_score",
    "fraud_type", "decision", "network_risk_score", "rule_flags",
    "alert_level", "created_at",
  ];
  const header = cols.join(",");
  const rows = data.map((d) =>
    cols
      .map((c) => {
        const v = d[c] ?? "";
        return typeof v === "string" && v.includes(",") ? `"${v}"` : v;
      })
      .join(",")
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `invoices-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
