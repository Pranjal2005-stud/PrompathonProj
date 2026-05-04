import { motion } from "framer-motion";
import { X, ShieldX, Copy, AlertTriangle, Brain, DollarSign, Hash, Building2 } from "lucide-react";
import RiskBadge from "./RiskBadge";
import DecisionBadge from "./DecisionBadge";

const flagConfig = {
  "Overbilling":        { icon: ShieldX,      color: "#ef4444", bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.2)" },
  "Duplicate Invoice":  { icon: Copy,         color: "#f59e0b", bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.2)" },
  "Duplicate Pattern":  { icon: Copy,         color: "#f59e0b", bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.2)" },
  "Missing PO":         { icon: AlertTriangle, color: "#f97316", bg: "rgba(249,115,22,0.08)", border: "rgba(249,115,22,0.2)" },
  "High Deviation":     { icon: AlertTriangle, color: "#f59e0b", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.2)" },
  "Overpayment":        { icon: DollarSign,   color: "#ef4444", bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.2)" },
  "Quantity Mismatch":  { icon: AlertTriangle, color: "#8b5cf6", bg: "rgba(139,92,246,0.08)", border: "rgba(139,92,246,0.2)" },
};

export default function InvoiceDrawer({ invoice, onClose }) {
  if (!invoice) return null;
  const flags = (invoice.reason || "").split(",").map(f => f.trim()).filter(f => f && f !== "Normal");

  const details = [
    { icon: Hash,      label: "Invoice ID",       value: invoice.invoice_id },
    { icon: Building2, label: "Vendor",            value: invoice.vendor_name },
    { icon: DollarSign,label: "Invoice Amount",    value: invoice.invoice_amount ? `₹${invoice.invoice_amount.toLocaleString()}` : "—" },
    { icon: DollarSign,label: "Approved PO Amt",   value: invoice.approved_amount_po ? `₹${invoice.approved_amount_po.toLocaleString()}` : "—" },
    { icon: DollarSign,label: "Paid Amount",       value: invoice.paid_amount ? `₹${invoice.paid_amount.toLocaleString()}` : "—" },
    { icon: ShieldX,   label: "Anomaly Score",     value: invoice.anomaly_score?.toFixed(4) ?? "—" },
  ];

  const aiText = invoice.decision === "BLOCK"
    ? `This invoice was automatically blocked. Detected issues: ${invoice.reason || "anomalous ML signal"}. Risk score ${invoice.risk_score?.toFixed(1)} exceeds the safe threshold of 70.`
    : invoice.decision === "REVIEW"
    ? `Moderate risk indicators detected (score: ${invoice.risk_score?.toFixed(1)}). Manual review required. Reason: ${invoice.reason || "ML anomaly signal"}.`
    : `This invoice passed all fraud checks. Risk score ${invoice.risk_score?.toFixed(1)} is within safe limits.`;

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-40" style={{ background: "rgba(15,23,42,0.25)", backdropFilter: "blur(4px)" }}
        onClick={onClose} />

      <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        className="fixed top-0 right-0 h-full w-96 z-50 flex flex-col border-l"
        style={{ background: "rgba(255,255,255,0.95)", backdropFilter: "blur(24px)", borderColor: "rgba(99,102,241,0.15)", boxShadow: "-8px 0 40px rgba(0,0,0,0.12)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
          <div>
            <p className="text-sm font-bold text-slate-800">Invoice Details</p>
            <p className="text-xs text-slate-400 font-mono mt-0.5">{invoice.invoice_id ?? "—"}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-slate-100 text-slate-500">
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Badges */}
          <div className="flex items-center gap-2">
            <DecisionBadge decision={invoice.decision} />
            <RiskBadge score={invoice.risk_score} />
          </div>

          {/* Details */}
          <div className="rounded-2xl border divide-y overflow-hidden" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
            {details.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50/80 transition-colors">
                <div className="flex items-center gap-2">
                  <Icon size={13} className="text-slate-400" />
                  <span className="text-xs text-slate-500">{label}</span>
                </div>
                <span className="text-xs font-semibold text-slate-700">{value ?? "—"}</span>
              </div>
            ))}
          </div>

          {/* Flags */}
          {flags.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Fraud Flags</p>
              <div className="space-y-2">
                {flags.map((flag) => {
                  const cfg = flagConfig[flag] || { icon: AlertTriangle, color: "#64748b", bg: "rgba(100,116,139,0.08)", border: "rgba(100,116,139,0.2)" };
                  const Icon = cfg.icon;
                  return (
                    <div key={flag} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border"
                      style={{ background: cfg.bg, borderColor: cfg.border }}>
                      <Icon size={13} style={{ color: cfg.color }} />
                      <span className="text-xs font-semibold" style={{ color: cfg.color }}>{flag}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* AI Explanation */}
          <div className="rounded-2xl p-4 border" style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.06), rgba(139,92,246,0.06))", borderColor: "rgba(99,102,241,0.2)" }}>
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "rgba(99,102,241,0.15)" }}>
                <Brain size={13} style={{ color: "#6366f1" }} />
              </div>
              <p className="text-xs font-bold text-indigo-700">Why was this flagged?</p>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: "#4f46e5" }}>{aiText}</p>
          </div>

        </div>
      </motion.div>
    </>
  );
}
