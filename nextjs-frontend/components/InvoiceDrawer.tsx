"use client";
import { useState, useEffect, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Brain, ShieldX, Copy, AlertTriangle, DollarSign,
  Hash, Building2, Calendar, CheckCircle, Clock, Loader2, RefreshCw, Maximize2,
} from "lucide-react";
import { useAppStore } from "@/store";
import { getAIExplanation, submitReviewerAction } from "@/services/api";
import { parseAIText, RISK_KEYWORDS } from "@/lib/utils";
import { RiskBadge, DecisionBadge, SectionTitle } from "@/components/ui/primitives";

const FLAG_CFG: Record<string, { icon: React.ElementType; color: string; bg: string; border: string }> = {
  "Overbilling":             { icon: ShieldX,      color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
  "Duplicate Pattern":       { icon: Copy,          color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  "Missing PO":              { icon: AlertTriangle, color: "#ea580c", bg: "#fff7ed", border: "#fed7aa" },
  "High Deviation":          { icon: AlertTriangle, color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  "Extreme Deviation":       { icon: AlertTriangle, color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
  "Overpayment":             { icon: DollarSign,    color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
  "Split Invoice Pattern":   { icon: Copy,          color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
  "Weekend Invoice":         { icon: Calendar,      color: "#0891b2", bg: "#ecfeff", border: "#a5f3fc" },
  "Rapid Resubmission":      { icon: Clock,         color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  "Unknown Vendor":          { icon: Building2,     color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
  "Overpriced vs Benchmark": { icon: DollarSign,    color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
};

const ACTIONS = [
  { label: "Approve",               color: "#059669", bg: "#f0fdf4", border: "#bbf7d0" },
  { label: "Escalate",              color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
  { label: "Request Clarification", color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  { label: "Freeze Payment",        color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
];

function HighlightedText({ text }: { text: string }) {
  const keywords = Object.keys(RISK_KEYWORDS).sort((a, b) => b.length - a.length);
  const regex = new RegExp(`\\b(${keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "gi");
  const parts: { type: "text" | "badge"; content: string; cfg?: (typeof RISK_KEYWORDS)[string] }[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push({ type: "text", content: text.slice(last, match.index) });
    const key = match[0].toUpperCase();
    const cfg = RISK_KEYWORDS[key];
    parts.push({ type: "badge", content: match[0], cfg });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ type: "text", content: text.slice(last) });
  return (
    <span>
      {parts.map((p, i) =>
        p.type === "badge" && p.cfg ? (
          <span key={i} className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold mx-0.5"
            style={{ background: p.cfg.bg, color: p.cfg.color, border: `1px solid ${p.cfg.border}` }}>
            {p.content}
          </span>
        ) : <span key={i}>{p.content}</span>
      )}
    </span>
  );
}

function AIRenderer({ text }: { text: string }) {
  const sections = parseAIText(text);
  const confMatch = text.match(/(\d{1,3})%/);
  const confidence = confMatch ? parseInt(confMatch[1]) : null;
  return (
    <div className="space-y-4">
      {sections.map((section, si) => (
        <div key={si}>
          {section.title && <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">{section.title}</p>}
          <div className="space-y-1.5">
            {section.lines.map((line, li) => {
              const isBullet = /^[-•*]\s/.test(line) || /^\d+\.\s/.test(line);
              const cleanLine = line.replace(/^[-•*\d.]\s+/, "");
              if (/confidence/i.test(section.title ?? "") && /\d+%/.test(line) && confidence) {
                return (
                  <div key={li} className="mt-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-500">Confidence</span>
                      <span className="text-sm font-bold" style={{ color: confidence >= 70 ? "#dc2626" : confidence >= 40 ? "#d97706" : "#059669" }}>{confidence}%</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden bg-slate-100">
                      <motion.div className="h-full rounded-full"
                        style={{ background: confidence >= 70 ? "#dc2626" : confidence >= 40 ? "#d97706" : "#059669" }}
                        initial={{ width: "0%" }} animate={{ width: `${confidence}%` }} transition={{ duration: 0.8, delay: 0.2 }} />
                    </div>
                  </div>
                );
              }
              if (isBullet) {
                return (
                  <div key={li} className="flex items-start gap-2 px-3 py-2 rounded-lg" style={{ background: "#f8fafc", border: "1px solid #f1f5f9" }}>
                    <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 bg-slate-400" />
                    <p className="text-sm text-slate-600 leading-relaxed"><HighlightedText text={cleanLine} /></p>
                  </div>
                );
              }
              return <p key={li} className="text-sm text-slate-600 leading-relaxed"><HighlightedText text={line} /></p>;
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

const InvoiceDrawer = memo(function InvoiceDrawer() {
  const { selectedInvoice: invoice, setSelectedInvoice } = useAppStore();
  const [action, setAction]       = useState<string | null>(null);
  const [note, setNote]           = useState("");
  const [aiText, setAiText]       = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError]     = useState<string | null>(null);
  const [expanded, setExpanded]   = useState(false);

  const fetchAI = async () => {
    if (!invoice) return;
    setAiText(null); setAiError(null); setAiLoading(true);
    try { setAiText(await getAIExplanation(invoice)); }
    catch (e: unknown) { setAiError(`Could not load AI explanation: ${e instanceof Error ? e.message : "Unknown error"}`); }
    finally { setAiLoading(false); }
  };

  useEffect(() => { fetchAI(); }, [invoice?.invoice_id]);

  if (!invoice) return null;

  const flags = (invoice.reason ?? "").split(",").map((f) => f.trim()).filter((f) => f && f !== "Normal");
  const details = [
    { icon: Hash,       label: "Invoice ID",    value: String(invoice.invoice_id) },
    { icon: Building2,  label: "Vendor",         value: invoice.vendor_name },
    { icon: DollarSign, label: "Amount",          value: invoice.invoice_amount ? `₹${Number(invoice.invoice_amount).toLocaleString()}` : "—" },
    { icon: DollarSign, label: "Approved PO",     value: invoice.approved_amount_po ? `₹${Number(invoice.approved_amount_po).toLocaleString()}` : "—" },
    { icon: Brain,      label: "ML Score",        value: invoice.ml_risk_score ? `${Number(invoice.ml_risk_score).toFixed(1)} / 100` : "—" },
    { icon: Brain,      label: "Rule Score",      value: invoice.rule_score ? `${Number(invoice.rule_score).toFixed(1)} / 100` : "—" },
    { icon: Brain,      label: "Behavior Score",  value: invoice.behavior_score ? `${Number(invoice.behavior_score).toFixed(1)} / 100` : "—" },
    { icon: Brain,      label: "Data Confidence", value: invoice.data_confidence ? `${(invoice.data_confidence * 100).toFixed(0)}%` : "—" },
  ];
  const timeline = [
    { icon: Calendar,     label: "Invoice Submitted",   color: "#2563eb", time: invoice.invoice_date ?? "—" },
    { icon: Brain,        label: "AI Analysis Complete", color: "#7c3aed", time: "Processed" },
    ...(flags.length > 0 ? [{ icon: AlertTriangle, label: `${flags.length} Flag(s) Detected`, color: "#d97706", time: "Flagged" }] : []),
    {
      icon: invoice.decision === "BLOCK" ? ShieldX : invoice.decision === "REVIEW" ? Clock : CheckCircle,
      label: `Decision: ${invoice.decision}`,
      color: invoice.decision === "BLOCK" ? "#dc2626" : invoice.decision === "REVIEW" ? "#d97706" : "#059669",
      time: "Final",
    },
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 flex items-center justify-center p-6"
        style={{ background: "rgba(15,23,42,0.6)", backdropFilter: "blur(4px)" }}
        onClick={() => setSelectedInvoice(null)}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ type: "spring", damping: 28, stiffness: 340 }}
          onClick={(e) => e.stopPropagation()}
          className="relative flex flex-col overflow-hidden bg-white"
          style={{
            borderRadius: "20px",
            boxShadow: "0 32px 80px rgba(0,0,0,0.22), 0 8px 24px rgba(0,0,0,0.12)",
            width: expanded ? "900px" : "680px",
            maxWidth: "95vw",
            maxHeight: "88vh",
            transition: "width 0.3s ease",
          }}
        >
          <div className="flex items-center justify-between px-7 py-5 shrink-0" style={{ borderBottom: "1px solid #f1f5f9" }}>
            <div>
              <p className="text-base font-semibold text-slate-800">Forensic Invoice Analysis</p>
              <p className="text-xs text-slate-400 font-mono mt-0.5">#{invoice.invoice_id ?? "—"}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setExpanded((e) => !e)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"><Maximize2 size={14} /></button>
              <button onClick={() => setSelectedInvoice(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"><X size={15} /></button>
            </div>
          </div>

          <div className="px-7 py-3 flex items-center gap-3 shrink-0" style={{ borderBottom: "1px solid #f1f5f9" }}>
            <DecisionBadge decision={invoice.decision} />
            <RiskBadge score={invoice.risk_score} />
            <span className="text-xs text-slate-400 ml-auto">Confidence {invoice.data_confidence ? `${(invoice.data_confidence * 100).toFixed(0)}%` : "—"}</span>
          </div>

          <div className={`flex-1 overflow-hidden ${expanded ? "flex" : ""}`}>
            <div className={`overflow-y-auto ${expanded ? "w-1/2 border-r border-slate-50" : "w-full"}`}>
              <div className="px-7 py-5">
                <SectionTitle>Invoice Details</SectionTitle>
                <div className="space-y-0.5">
                  {details.map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-2.5"><Icon size={13} className="text-slate-400 shrink-0" /><span className="text-sm text-slate-500">{label}</span></div>
                      <span className="text-sm font-medium text-slate-700">{value ?? "—"}</span>
                    </div>
                  ))}
                </div>
              </div>
              {flags.length > 0 && (
                <div className="px-7 py-5 border-t border-slate-50">
                  <SectionTitle>Fraud Flags</SectionTitle>
                  <div className="space-y-2">
                    {flags.map((flag) => {
                      const cfg = FLAG_CFG[flag] ?? { icon: AlertTriangle, color: "#64748b", bg: "#f8fafc", border: "#e2e8f0" };
                      const FlagIcon = cfg.icon;
                      return (
                        <div key={flag} className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl" style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                          <FlagIcon size={13} style={{ color: cfg.color }} />
                          <span className="text-sm font-medium" style={{ color: cfg.color }}>{flag}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="px-7 py-5 border-t border-slate-50">
                <SectionTitle>Fraud Timeline</SectionTitle>
                <div className="space-y-3">
                  {timeline.map(({ icon: TIcon, label, color, time }, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}12` }}><TIcon size={12} style={{ color }} /></div>
                      <p className="flex-1 text-sm text-slate-600">{label}</p>
                      <span className="text-xs text-slate-400">{time}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="px-7 py-5 border-t border-slate-50">
                <SectionTitle>Auditor Actions</SectionTitle>
                <div className="grid grid-cols-2 gap-2">
                  {ACTIONS.map(({ label, color, bg, border }) => (
                    <button key={label} onClick={() => setAction(label)}
                      className="px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                      style={action === label ? { background: color, color: "#ffffff", border: `1px solid ${color}` } : { background: bg, color, border: `1px solid ${border}` }}>
                      {label}
                    </button>
                  ))}
                </div>
                <textarea value={note} onChange={(e) => setNote(e.target.value)}
                  placeholder="Add investigation notes…" rows={2}
                  className="w-full text-sm text-slate-700 rounded-xl px-3.5 py-3 outline-none resize-none placeholder:text-slate-400 mt-3"
                  style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }} />
              </div>
            </div>

            <div className={`overflow-y-auto ${expanded ? "w-1/2" : "border-t border-slate-50"}`}>
              <div className="px-7 py-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#f5f3ff" }}><Brain size={13} style={{ color: "#7c3aed" }} /></div>
                    <div>
                      <p className="text-sm font-semibold text-slate-700">AI Forensic Verdict</p>
                      <p className="text-[10px] text-slate-400">Groq · llama-3.3-70b-versatile</p>
                    </div>
                  </div>
                  {!aiLoading && <button onClick={fetchAI} className="text-slate-400 hover:text-slate-600 transition-colors"><RefreshCw size={12} /></button>}
                </div>
                <div className="rounded-xl p-4" style={{ background: "#fafafa", border: "1px solid #f1f5f9" }}>
                  {aiLoading && <div className="flex items-center gap-2 py-4"><Loader2 size={14} className="animate-spin text-slate-400" /><p className="text-sm text-slate-400">Generating forensic analysis…</p></div>}
                  {aiError && <p className="text-sm text-red-500 leading-relaxed">{aiError}</p>}
                  {aiText && !aiLoading && <AIRenderer text={aiText} />}
                  {!aiText && !aiLoading && !aiError && <p className="text-sm text-slate-400">AI explanation will appear here.</p>}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
});

export default InvoiceDrawer;
