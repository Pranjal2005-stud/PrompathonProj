import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  X, Brain, ShieldX, Copy, AlertTriangle, DollarSign,
  Hash, Building2, Calendar, CheckCircle, Clock, MessageSquare,
  Loader2, RefreshCw,
} from "lucide-react";
import RiskBadge from "./RiskBadge";
import DecisionBadge from "./DecisionBadge";

const FLAG_CFG = {
  "Overbilling":              { icon: ShieldX,      color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
  "Duplicate Pattern":        { icon: Copy,          color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  "Duplicate Invoice":        { icon: Copy,          color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  "Missing PO":               { icon: AlertTriangle, color: "#ea580c", bg: "#fff7ed", border: "#fed7aa" },
  "High Deviation":           { icon: AlertTriangle, color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  "Extreme Deviation":        { icon: AlertTriangle, color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
  "Overpayment":              { icon: DollarSign,    color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
  "Split Invoice Pattern":    { icon: Copy,          color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
  "Weekend Invoice":          { icon: Calendar,      color: "#0891b2", bg: "#ecfeff", border: "#a5f3fc" },
  "Rapid Resubmission":       { icon: Clock,         color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  "Unknown Vendor":           { icon: Building2,     color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
  "Bank Account Mismatch":    { icon: ShieldX,       color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
  "Overpriced vs Benchmark":  { icon: DollarSign,    color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
  "Rounded Amount":           { icon: AlertTriangle, color: "#0891b2", bg: "#ecfeff", border: "#a5f3fc" },
};

const ACTIONS = [
  { label: "Approve",               color: "#059669", bg: "#f0fdf4", border: "#bbf7d0" },
  { label: "Escalate",              color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
  { label: "Request Clarification", color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  { label: "Freeze Payment",        color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
];

function Divider() {
  return <div className="border-b" style={{ borderColor: "#f1f5f9" }} />;
}

function SectionTitle({ children }) {
  return (
    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3">
      {children}
    </p>
  );
}

async function fetchExplanation(invoice) {
  const res = await fetch("http://localhost:8000/explain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ invoice }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.explanation;
}

export default function InvoiceDrawer({ invoice, onClose }) {
  const [action, setAction]         = useState(null);
  const [note, setNote]             = useState("");
  const [aiExplanation, setAiExpl]  = useState(null);
  const [aiLoading, setAiLoading]   = useState(false);
  const [aiError, setAiError]       = useState(null);

  // Fetch AI explanation whenever invoice changes
  useEffect(() => {
    if (!invoice) return;
    setAiExpl(null);
    setAiError(null);
    setAiLoading(true);
    fetchExplanation(invoice)
      .then(text => setAiExpl(text))
      .catch(err => setAiError(`Could not load AI explanation: ${err.message}`))
      .finally(() => setAiLoading(false));
  }, [invoice?.invoice_id]);

  if (!invoice) return null;

  const flags = (invoice.reason || "")
    .split(",").map(f => f.trim()).filter(f => f && f !== "Normal");

  const timeline = [
    { icon: Calendar,     label: "Invoice Submitted",    color: "#2563eb", time: invoice.invoice_date || "—" },
    { icon: Brain,        label: "AI Analysis Complete",  color: "#7c3aed", time: "Processed" },
    ...(flags.length > 0 ? [{ icon: AlertTriangle, label: `${flags.length} Flag(s) Detected`, color: "#d97706", time: "Flagged" }] : []),
    {
      icon:  invoice.decision === "BLOCK" ? ShieldX : invoice.decision === "REVIEW" ? Clock : CheckCircle,
      label: `Decision: ${invoice.decision}`,
      color: invoice.decision === "BLOCK" ? "#dc2626" : invoice.decision === "REVIEW" ? "#d97706" : "#059669",
      time:  "Final",
    },
  ];

  const details = [
    { icon: Hash,       label: "Invoice ID",      value: invoice.invoice_id },
    { icon: Building2,  label: "Vendor",           value: invoice.vendor_name },
    { icon: DollarSign, label: "Invoice Amount",   value: invoice.invoice_amount     ? `₹${Number(invoice.invoice_amount).toLocaleString()}`     : "—" },
    { icon: DollarSign, label: "Approved PO",      value: invoice.approved_amount_po ? `₹${Number(invoice.approved_amount_po).toLocaleString()}` : "—" },
    { icon: DollarSign, label: "Paid Amount",      value: invoice.paid_amount        ? `₹${Number(invoice.paid_amount).toLocaleString()}`        : "—" },
    { icon: Brain,      label: "ML Score",         value: invoice.ml_risk_score      ? `${Number(invoice.ml_risk_score).toFixed(1)} / 100`       : "—" },
    { icon: Brain,      label: "Rule Score",       value: invoice.rule_score         ? `${Number(invoice.rule_score).toFixed(1)} / 100`          : "—" },
    { icon: Brain,      label: "Behavior Score",   value: invoice.behavior_score     ? `${Number(invoice.behavior_score).toFixed(1)} / 100`      : "—" },
    { icon: Brain,      label: "Data Confidence",  value: invoice.data_confidence    ? `${(invoice.data_confidence * 100).toFixed(0)}%`          : "—" },
  ];

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-40"
        style={{ background: "rgba(15,23,42,0.3)" }}
        onClick={onClose}
      />

      <motion.div
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 320 }}
        className="fixed top-0 right-0 h-full w-[460px] z-50 flex flex-col"
        style={{ background: "#ffffff", borderLeft: "1px solid #e2e8f0", boxShadow: "-4px 0 24px rgba(0,0,0,0.1)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0" style={{ borderColor: "#e2e8f0" }}>
          <div>
            <p className="text-sm font-semibold text-slate-800">Forensic Invoice Analysis</p>
            <p className="text-xs text-slate-400 font-mono mt-0.5">#{invoice.invoice_id ?? "—"}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* Decision strip */}
        <div className="px-6 py-3 flex items-center gap-3 border-b shrink-0" style={{ borderColor: "#f1f5f9" }}>
          <DecisionBadge decision={invoice.decision} />
          <RiskBadge score={invoice.risk_score} />
          <span className="text-xs text-slate-400 ml-auto">
            Confidence {invoice.data_confidence ? `${(invoice.data_confidence * 100).toFixed(0)}%` : "—"}
          </span>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">

          {/* Details */}
          <div className="px-6 py-5">
            <SectionTitle>Invoice Details</SectionTitle>
            <div className="space-y-0.5">
              {details.map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <Icon size={13} className="text-slate-400 shrink-0" />
                    <span className="text-sm text-slate-500">{label}</span>
                  </div>
                  <span className="text-sm font-medium text-slate-700">{value ?? "—"}</span>
                </div>
              ))}
            </div>
          </div>

          <Divider />

          {/* Fraud Flags */}
          {flags.length > 0 && (
            <>
              <div className="px-6 py-5">
                <SectionTitle>Fraud Flags Triggered</SectionTitle>
                <div className="space-y-2">
                  {flags.map(flag => {
                    const cfg = FLAG_CFG[flag] || { icon: AlertTriangle, color: "#64748b", bg: "#f8fafc", border: "#e2e8f0" };
                    const Icon = cfg.icon;
                    return (
                      <div key={flag} className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg"
                        style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                        <Icon size={13} style={{ color: cfg.color }} />
                        <span className="text-sm font-medium" style={{ color: cfg.color }}>{flag}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <Divider />
            </>
          )}

          {/* Timeline */}
          <div className="px-6 py-5">
            <SectionTitle>Fraud Timeline</SectionTitle>
            <div className="space-y-3">
              {timeline.map(({ icon: Icon, label, color, time }, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}12` }}>
                    <Icon size={12} style={{ color }} />
                  </div>
                  <p className="flex-1 text-sm text-slate-600">{label}</p>
                  <span className="text-xs text-slate-400">{time}</span>
                </div>
              ))}
            </div>
          </div>

          <Divider />

          {/* AI Explanation — fetched from Groq */}
          <div className="px-6 py-5">
            <div className="flex items-center justify-between mb-3">
              <SectionTitle>AI Forensic Explanation</SectionTitle>
              {!aiLoading && (
                <button onClick={() => {
                  setAiExpl(null); setAiError(null); setAiLoading(true);
                  fetchExplanation(invoice)
                    .then(t => setAiExpl(t))
                    .catch(e => setAiError(e.message))
                    .finally(() => setAiLoading(false));
                }} className="text-slate-400 hover:text-slate-600 transition-colors mb-3">
                  <RefreshCw size={12} />
                </button>
              )}
            </div>

            <div className="rounded-lg p-4" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "#f5f3ff" }}>
                  <Brain size={12} style={{ color: "#7c3aed" }} />
                </div>
                <p className="text-xs font-semibold text-slate-600">Groq AI Auditor · llama-3.3-70b-versatile</p>
              </div>

              {aiLoading && (
                <div className="flex items-center gap-2 py-2">
                  <Loader2 size={14} className="animate-spin text-slate-400" />
                  <p className="text-sm text-slate-400">Generating forensic analysis...</p>
                </div>
              )}

              {aiError && (
                <p className="text-sm text-red-500 leading-relaxed">{aiError}</p>
              )}

              {aiExplanation && !aiLoading && (
                <p className="text-sm leading-relaxed text-slate-600 whitespace-pre-wrap">{aiExplanation}</p>
              )}
            </div>
          </div>

          <Divider />

          {/* Actions */}
          <div className="px-6 py-5">
            <SectionTitle>Auditor Actions</SectionTitle>
            <div className="grid grid-cols-2 gap-2">
              {ACTIONS.map(({ label, color, bg, border }) => (
                <button key={label} onClick={() => setAction(label)}
                  className="px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
                  style={action === label
                    ? { background: color, color: "#ffffff", border: `1px solid ${color}` }
                    : { background: bg, color, border: `1px solid ${border}` }}>
                  {label}
                </button>
              ))}
            </div>
            {action && (
              <p className="text-xs text-slate-400 mt-2 text-center">
                Action recorded: <span className="font-semibold text-slate-600">{action}</span>
              </p>
            )}
          </div>

          <Divider />

          {/* Notes */}
          <div className="px-6 py-5">
            <SectionTitle>
              <MessageSquare size={10} className="inline mr-1" />
              Auditor Notes
            </SectionTitle>
            <textarea value={note} onChange={e => setNote(e.target.value)}
              placeholder="Add investigation notes, evidence references, or escalation details…"
              rows={3}
              className="w-full text-sm text-slate-700 rounded-lg px-3.5 py-3 outline-none resize-none placeholder:text-slate-400"
              style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }} />
          </div>

        </div>
      </motion.div>
    </>
  );
}
