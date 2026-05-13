"use client";
import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldX, Copy, AlertTriangle, DollarSign, Zap,
  CheckCircle, ArrowUpRight, Pause, MessageSquare,
  XCircle, Filter, RefreshCw, Bell, X, Brain, Loader2,
} from "lucide-react";
import { useAppStore } from "@/store";
import { SEVERITY_COLORS, SEVERITY_ORDER, getAlertSeverity } from "@/lib/utils";
import { submitReviewerAction, getAIExplanation } from "@/services/api";
import type { Invoice } from "@/types";

// ── Constants ─────────────────────────────────────────────────────────────────

const FRAUD_ICONS: Record<string, { icon: React.ElementType; color: string }> = {
  "Split Invoice Fraud":    { icon: Copy,          color: "#7c3aed" },
  "Shell Vendor Fraud":     { icon: ShieldX,       color: "#dc2626" },
  "Duplicate Invoice Fraud":{ icon: Copy,          color: "#d97706" },
  "Overbilling Fraud":      { icon: DollarSign,    color: "#dc2626" },
  "Overpayment Fraud":      { icon: DollarSign,    color: "#dc2626" },
  "Anomalous Pattern":      { icon: AlertTriangle, color: "#d97706" },
  default:                  { icon: Zap,           color: "#dc2626" },
};

const REVIEWER_ACTIONS = [
  { id: "APPROVE",      label: "Approve",      icon: CheckCircle,   color: "#059669", bg: "#f0fdf4", border: "#bbf7d0" },
  { id: "ESCALATE",     label: "Escalate",     icon: ArrowUpRight,  color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
  { id: "FREEZE",       label: "Freeze",       icon: Pause,         color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
  { id: "REQUEST_INFO", label: "Request Info", icon: MessageSquare, color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  { id: "REJECT",       label: "Reject",       icon: XCircle,       color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
];

// Keywords to highlight in AI explanation
const AI_HIGHLIGHTS: { pattern: RegExp; color: string; bg: string }[] = [
  { pattern: /\b(BLOCK|blocked|fraud|fraudulent|suspicious|critical|shell vendor|split invoice|collusion)\b/gi, color: "#dc2626", bg: "#fef2f2" },
  { pattern: /\b(REVIEW|review|investigate|escalate|monitor|anomal\w+)\b/gi,                                   color: "#d97706", bg: "#fffbeb" },
  { pattern: /\b(APPROVE|approved|legitimate|normal|low risk)\b/gi,                                            color: "#059669", bg: "#f0fdf4" },
  { pattern: /\b(bank account|GST|PAN|duplicate|overbilling|overpayment|missing PO)\b/gi,                      color: "#7c3aed", bg: "#f5f3ff" },
];

function HighlightedAI({ text }: { text: string }) {
  // Split text into sentences/lines for better readability
  const lines = text.split(/\n+/).filter(Boolean);

  return (
    <div className="space-y-3">
      {lines.map((line, li) => {
        // Apply highlights
        let parts: { text: string; color?: string; bg?: string }[] = [{ text: line }];

        AI_HIGHLIGHTS.forEach(({ pattern, color, bg }) => {
          parts = parts.flatMap((part) => {
            if (part.color) return [part]; // already highlighted
            const segments: typeof parts = [];
            let last = 0;
            let match: RegExpExecArray | null;
            const re = new RegExp(pattern.source, pattern.flags);
            while ((match = re.exec(part.text)) !== null) {
              if (match.index > last) segments.push({ text: part.text.slice(last, match.index) });
              segments.push({ text: match[0], color, bg });
              last = match.index + match[0].length;
            }
            if (last < part.text.length) segments.push({ text: part.text.slice(last) });
            return segments.length ? segments : [part];
          });
        });

        return (
          <p key={li} className="text-sm text-slate-700 leading-relaxed">
            {parts.map((p, pi) =>
              p.color ? (
                <span key={pi} className="inline-flex items-center px-1.5 py-0.5 rounded-md text-xs font-semibold mx-0.5"
                  style={{ background: p.bg, color: p.color }}>
                  {p.text}
                </span>
              ) : (
                <span key={pi}>{p.text}</span>
              )
            )}
          </p>
        );
      })}
    </div>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function DetailPanel({ item, onClose }: { item: Invoice; onClose: () => void }) {
  const [action, setAction]       = useState<string | null>(null);
  const [note, setNote]           = useState("");
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [aiText, setAiText]       = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError]     = useState<string | null>(null);
  const setSelectedInvoice        = useAppStore((s) => s.setSelectedInvoice);

  useEffect(() => {
    setAction(null); setNote(""); setSaved(false);
    setAiText(null); setAiError(null); setAiLoading(true);
    getAIExplanation(item)
      .then((t) => setAiText(t))
      .catch((e) => setAiError(`AI unavailable: ${e.message}`))
      .finally(() => setAiLoading(false));
  }, [item.invoice_id]);

  const sev   = getAlertSeverity(item);
  const sc    = SEVERITY_COLORS[sev] ?? SEVERITY_COLORS.HIGH;
  const fi    = FRAUD_ICONS[item.fraud_type ?? ""] ?? FRAUD_ICONS.default;
  const Icon  = fi.icon;
  const flags = (item.rule_flags ?? item.reason ?? "")
    .split(",").map((f) => f.trim()).filter((f) => f && f !== "None");

  const submit = async () => {
    if (!action) return;
    setSaving(true);
    try { await submitReviewerAction(item.invoice_id, action, note); setSaved(true); }
    catch { /* offline */ } finally { setSaving(false); }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ type: "spring", damping: 28, stiffness: 300 }}
      className="flex flex-col h-full overflow-hidden"
      style={{ borderLeft: "1px solid #e2e8f0" }}
    >
      {/* ── Header ── */}
      <div className="px-6 py-5 shrink-0 flex items-start gap-4" style={{ borderBottom: "1px solid #e2e8f0" }}>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: sc.bg }}>
          <Icon size={20} style={{ color: fi.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-bold px-2.5 py-1 rounded-lg"
              style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
              {sev}
            </span>
            {item.fraud_type && item.fraud_type !== "Normal" && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                style={{ background: "#f5f3ff", color: "#7c3aed", border: "1px solid #ddd6fe" }}>
                {item.fraud_type}
              </span>
            )}
          </div>
          <p className="text-base font-bold text-slate-800 truncate">{item.vendor_name ?? "Unknown Vendor"}</p>
          <p className="text-xs text-slate-400 font-mono mt-0.5">Invoice #{item.invoice_id}</p>
        </div>
        {/* Risk score */}
        <div className="shrink-0 text-right">
          <p className="text-3xl font-bold leading-none tabular-nums" style={{ color: sc.color }}>
            {(item.risk_score ?? 0).toFixed(0)}
          </p>
          <p className="text-xs text-slate-400 mt-1">/ 100 risk</p>
        </div>
        <button onClick={onClose}
          className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors">
          <X size={15} />
        </button>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto">

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 px-6 py-4" style={{ borderBottom: "1px solid #f1f5f9" }}>
          {[
            { label: "Invoice Amount", value: item.invoice_amount ? `₹${Number(item.invoice_amount).toLocaleString("en-IN")}` : "—", color: sc.color },
            { label: "ML Score",       value: item.ml_risk_score  ? `${Number(item.ml_risk_score).toFixed(0)} / 100` : "—",          color: "#7c3aed" },
            { label: "Decision",       value: item.decision ?? "—",
              color: item.decision === "BLOCK" ? "#dc2626" : item.decision === "REVIEW" ? "#d97706" : "#059669" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl p-3 text-center" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <p className="text-xs text-slate-400 mb-1.5">{label}</p>
              <p className="text-sm font-bold tabular-nums" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Invoice details */}
        <div className="px-6 py-4" style={{ borderBottom: "1px solid #f1f5f9" }}>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Invoice Details</p>
          <div className="space-y-1.5">
            {[
              { label: "Vendor ID",    value: item.vendor_id  ?? "—",  color: "#2563eb" },
              { label: "Decision",     value: item.decision   ?? "—",
                color: item.decision === "BLOCK" ? "#dc2626" : item.decision === "REVIEW" ? "#d97706" : "#059669" },
              { label: "Date",         value: item.created_at ?? item.invoice_date ?? "—", color: "#475569" },
              { label: "Rule Score",   value: item.rule_score != null ? `${Number(item.rule_score).toFixed(0)} / 100` : "—", color: "#d97706" },
              { label: "Network Risk", value: item.network_risk_score != null ? `${Number(item.network_risk_score).toFixed(0)} / 100` : "—", color: "#7c3aed" },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between py-2 px-3 rounded-xl"
                style={{ background: "#f8fafc", border: "1px solid #f1f5f9" }}>
                <span className="text-sm text-slate-500">{label}</span>
                <span className="text-sm font-semibold" style={{ color }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Fraud flags */}
        {flags.length > 0 && (
          <div className="px-6 py-4" style={{ borderBottom: "1px solid #f1f5f9" }}>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Fraud Signals</p>
            <div className="flex flex-wrap gap-2">
              {flags.map((f) => (
                <span key={f} className="text-xs font-semibold px-3 py-1.5 rounded-xl"
                  style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>
                  {f}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* AI Explanation */}
        <div className="px-6 py-4" style={{ borderBottom: "1px solid #f1f5f9" }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: "#f5f3ff" }}>
              <Brain size={14} style={{ color: "#7c3aed" }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">AI Forensic Analysis</p>
              <p className="text-xs text-slate-400">Groq · llama-3.3-70b-versatile</p>
            </div>
          </div>
          <div className="rounded-xl p-4" style={{ background: "#fafafa", border: "1px solid #e2e8f0" }}>
            {aiLoading && (
              <div className="flex items-center gap-3 py-3">
                <Loader2 size={16} className="animate-spin text-purple-500" />
                <p className="text-sm text-slate-500">Generating forensic analysis…</p>
              </div>
            )}
            {aiError && (
              <p className="text-sm text-red-500 leading-relaxed">{aiError}</p>
            )}
            {aiText && !aiLoading && <HighlightedAI text={aiText} />}
          </div>
        </div>

        {/* Reviewer actions */}
        <div className="px-6 py-4">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Reviewer Decision</p>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {REVIEWER_ACTIONS.map(({ id, label, icon: ActionIcon, color, bg, border }) => (
              <button key={id} onClick={() => setAction(id)}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all"
                style={action === id
                  ? { background: color, color: "#fff", border: `1px solid ${color}` }
                  : { background: bg, color, border: `1px solid ${border}` }}>
                <ActionIcon size={11} />{label}
              </button>
            ))}
          </div>
          <textarea value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Reviewer note (optional)…" rows={2}
            className="w-full text-sm text-slate-700 rounded-xl px-3.5 py-2.5 outline-none resize-none placeholder:text-slate-400 mb-3"
            style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }} />
          <div className="flex gap-2">
            <button onClick={submit} disabled={!action || saving}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 bg-blue-600">
              {saving ? "Saving…" : saved ? "✓ Decision Recorded" : "Submit Decision"}
            </button>
            <button onClick={() => setSelectedInvoice(item)}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)" }}>
              Full View
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Alert card ────────────────────────────────────────────────────────────────

function AlertCard({
  item, index, isSelected, isCompact, onSelect, onAck, isAcked,
}: {
  item: Invoice & { _severity: string };
  index: number;
  isSelected: boolean;
  isCompact: boolean;
  onSelect: (item: Invoice) => void;
  onAck: (id: string | number) => void;
  isAcked: boolean;
}) {
  const sc   = SEVERITY_COLORS[item._severity] ?? SEVERITY_COLORS.HIGH;
  const fi   = FRAUD_ICONS[item.fraud_type ?? ""] ?? FRAUD_ICONS.default;
  const Icon = fi.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02, duration: 0.18 }}
      onClick={() => onSelect(item)}
      className="flex items-center gap-3 rounded-xl cursor-pointer transition-all select-none"
      style={{
        padding: isCompact ? "10px 12px" : "12px 14px",
        border: isSelected ? `2px solid ${sc.color}` : "1px solid #e2e8f0",
        background: isSelected ? sc.bg : "#ffffff",
        opacity: isAcked ? 0.4 : 1,
        boxShadow: isSelected ? `0 0 0 3px ${sc.color}18` : "none",
      }}
      onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "#f8fafc"; }}
      onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "#ffffff"; }}
    >
      <div className="rounded-xl flex items-center justify-center shrink-0"
        style={{ width: 36, height: 36, minWidth: 36, background: sc.bg }}>
        <Icon size={15} style={{ color: fi.color }} />
      </div>

      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg shrink-0"
            style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
            {item._severity}
          </span>
          <span className="text-xs text-slate-400 font-mono truncate">#{item.invoice_id}</span>
        </div>
        <p className="text-sm font-semibold text-slate-800 truncate">{item.vendor_name ?? "Unknown"}</p>
        {!isCompact && (
          <p className="text-xs text-slate-500 truncate mt-0.5">
            {item.fraud_type && item.fraud_type !== "Normal" ? item.fraud_type : item.rule_flags ?? "Anomaly"}
          </p>
        )}
      </div>

      <div className="shrink-0 flex flex-col items-end gap-1 ml-2">
        <p className="text-base font-bold tabular-nums leading-none" style={{ color: sc.color }}>
          {(item.risk_score ?? 0).toFixed(0)}
        </p>
        {!isAcked && (
          <button
            onClick={(e) => { e.stopPropagation(); onAck(item.invoice_id); }}
            className="text-[10px] text-slate-400 hover:text-slate-600 transition-colors">
            Ack
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AlertsPanel() {
  const { invoices: data, loading } = useAppStore();
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [acknowledged, setAcknowledged]     = useState<Set<string | number>>(new Set());
  const [selected, setSelected]             = useState<Invoice | null>(null);
  const [pulse, setPulse]                   = useState(false);

  useEffect(() => {
    const t = setInterval(() => { setPulse(true); setTimeout(() => setPulse(false), 600); }, 8000);
    return () => clearInterval(t);
  }, []);

  const { filtered, criticalCount } = useMemo(() => {
    const all = data
      .filter((d) =>
        (d.risk_score ?? 0) >= 45 || d.decision === "BLOCK" ||
        d.decision === "REVIEW" || (d.alert_level && d.alert_level !== "LOW")
      )
      .map((d) => ({ ...d, _severity: getAlertSeverity(d) }))
      .sort((a, b) => (SEVERITY_ORDER[a._severity] ?? 9) - (SEVERITY_ORDER[b._severity] ?? 9));
    const filt = severityFilter === "ALL" ? all : all.filter((d) => d._severity === severityFilter);
    return { filtered: filt, criticalCount: all.filter((d) => d._severity === "CRITICAL").length };
  }, [data, severityFilter]);

  const hasSelected = selected !== null;

  return (
    /* Constrained max-width so content doesn't stretch across huge screens */
    <div className="w-full max-w-6xl mx-auto h-full">
      <div className="flex h-full rounded-2xl overflow-hidden bg-white"
        style={{ border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.07)" }}>

        {/* ── LEFT: Alert list ── */}
        <motion.div
          animate={{ width: hasSelected ? "40%" : "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 280 }}
          className="flex flex-col overflow-hidden shrink-0"
          style={{ minWidth: hasSelected ? 260 : undefined }}
        >
          {/* Header */}
          <div className="px-5 py-4 shrink-0" style={{ borderBottom: "1px solid #e2e8f0" }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 ${pulse ? "animate-ping" : "animate-pulse"}`} />
                <p className="text-base font-semibold text-slate-800 whitespace-nowrap">Live Alerts</p>
                {criticalCount > 0 && (
                  <span className="text-xs font-bold text-white px-2 py-0.5 rounded-full animate-pulse shrink-0 bg-red-600">
                    {criticalCount} CRITICAL
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <RefreshCw size={12} className={`text-slate-400 ${pulse ? "animate-spin" : ""}`} />
                <span className="text-xs text-slate-400">Live</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {["ALL", "CRITICAL", "HIGH", "MEDIUM"].map((s) => {
                const sc = SEVERITY_COLORS[s] ?? { color: "#64748b", bg: "#f8fafc", border: "#e2e8f0" };
                const isActive = severityFilter === s;
                return (
                  <button key={s} onClick={() => setSeverityFilter(s)}
                    className="text-xs px-3 py-1 rounded-full font-semibold transition-colors whitespace-nowrap"
                    style={isActive
                      ? { background: sc.color, color: "#fff" }
                      : { background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                    {s}
                  </button>
                );
              })}
              <span className="ml-auto text-xs text-slate-400 flex items-center gap-1 shrink-0">
                <Filter size={10} /> {filtered.length}
              </span>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {loading && [1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
            {!loading && filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full py-16 text-center px-4">
                <Bell size={32} className="text-slate-200 mb-3" />
                <p className="text-sm font-medium text-slate-400">
                  {data.length === 0 ? "Upload invoices to begin monitoring" : "No alerts match filter"}
                </p>
              </div>
            )}
            <AnimatePresence>
              {filtered.map((item, i) => (
                <AlertCard
                  key={`${item.invoice_id}-${i}`}
                  item={item as Invoice & { _severity: string }}
                  index={i}
                  isSelected={selected?.invoice_id === item.invoice_id}
                  isCompact={hasSelected}
                  onSelect={(inv) => setSelected((prev) => prev?.invoice_id === inv.invoice_id ? null : inv)}
                  onAck={(id) => setAcknowledged((prev) => new Set([...prev, id]))}
                  isAcked={acknowledged.has(item.invoice_id)}
                />
              ))}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* ── RIGHT: Detail panel ── */}
        <AnimatePresence>
          {hasSelected && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: "60%", opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 280 }}
              className="overflow-hidden shrink-0"
              style={{ minWidth: 0 }}
            >
              <DetailPanel item={selected!} onClose={() => setSelected(null)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
