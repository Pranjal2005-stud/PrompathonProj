import { motion, AnimatePresence } from "framer-motion";
import { ShieldX, Copy, AlertTriangle, DollarSign, FileX, Zap } from "lucide-react";

const ALERT_TYPES = {
  "Duplicate Pattern": { icon: Copy,         color: "#d97706", bg: "#fffbeb", border: "#fde68a", label: "Duplicate"   },
  "Overbilling":       { icon: ShieldX,       color: "#dc2626", bg: "#fef2f2", border: "#fecaca", label: "Overbilling" },
  "Missing PO":        { icon: FileX,         color: "#ea580c", bg: "#fff7ed", border: "#fed7aa", label: "Missing PO"  },
  "Overpayment":       { icon: DollarSign,    color: "#dc2626", bg: "#fef2f2", border: "#fecaca", label: "Overpayment" },
  "High Deviation":    { icon: AlertTriangle, color: "#d97706", bg: "#fffbeb", border: "#fde68a", label: "Anomaly"     },
  "default":           { icon: Zap,           color: "#dc2626", bg: "#fef2f2", border: "#fecaca", label: "Fraud"       },
};

function getAlertCfg(reason) {
  for (const key of Object.keys(ALERT_TYPES)) {
    if (key !== "default" && (reason || "").includes(key)) return ALERT_TYPES[key];
  }
  return ALERT_TYPES.default;
}

export default function AlertsPanel({ data = [], loading, onSelect }) {
  const alerts = data
    .filter(d => d.decision === "BLOCK" || (d.risk_score || 0) > 65)
    .slice(0, 8);

  return (
    <div
      className="rounded-xl flex flex-col h-full overflow-hidden"
      style={{
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      {/* Header */}
      <div
        className="px-5 py-4 border-b flex items-center justify-between shrink-0"
        style={{ borderColor: "#e2e8f0" }}
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
          <p className="text-sm font-semibold text-slate-700">Live Fraud Alerts</p>
        </div>
        {alerts.length > 0 && (
          <span
            className="text-[10px] font-semibold text-white px-2 py-0.5 rounded-full"
            style={{ background: "#dc2626" }}
          >
            {alerts.length}
          </span>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading && [1, 2, 3].map(i => <div key={i} className="skeleton h-16 rounded-lg" />)}

        {!loading && alerts.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full py-10 text-center">
            <ShieldX size={24} className="text-slate-300 mb-2" />
            <p className="text-sm text-slate-400">No active alerts</p>
            <p className="text-xs text-slate-300 mt-1">Upload invoices to begin monitoring</p>
          </div>
        )}

        <AnimatePresence>
          {alerts.map((item, i) => {
            const cfg  = getAlertCfg(item.reason);
            const Icon = cfg.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => onSelect?.(item)}
                className="flex items-start gap-3 p-3.5 rounded-lg cursor-pointer transition-colors hover:bg-slate-50"
                style={{ border: "1px solid #e2e8f0" }}
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: cfg.bg }}
                >
                  <Icon size={13} style={{ color: cfg.color }} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
                    >
                      {cfg.label}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono truncate">#{item.invoice_id}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-700 truncate">{item.vendor_name || "Unknown Vendor"}</p>
                  <p className="text-xs text-slate-400 truncate mt-0.5">{item.reason || "Anomaly detected"}</p>
                </div>

                <div className="text-right shrink-0 ml-2">
                  <p className="text-sm font-semibold" style={{ color: cfg.color }}>
                    {(item.risk_score || 0).toFixed(0)}
                  </p>
                  <p className="text-[10px] text-slate-400">risk</p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
