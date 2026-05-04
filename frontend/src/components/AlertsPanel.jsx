import { motion } from "framer-motion";
import { ShieldX, AlertTriangle, Clock } from "lucide-react";

const CARD = { background: "rgba(255,255,255,0.25)", backdropFilter: "blur(24px)", borderColor: "rgba(255,255,255,0.5)", boxShadow: "0 4px 24px rgba(99,102,241,0.08)" };

export default function AlertsPanel({ data = [], loading }) {
  const alerts = data
    .filter((d) => d.decision === "BLOCK" || (d.risk_score || 0) > 70)
    .slice(0, 6);

  return (
    <div className="rounded-2xl p-5 border h-full" style={CARD}>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(239,68,68,0.1)" }}>
          <ShieldX size={14} style={{ color: "#ef4444" }} />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">Recent Alerts</p>
          <p className="text-xs text-slate-600">High-risk detections</p>
        </div>
        {alerts.length > 0 && (
          <span className="ml-auto text-xs font-bold text-white px-2 py-0.5 rounded-full" style={{ background: "#ef4444" }}>
            {alerts.length}
          </span>
        )}
      </div>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />)}
        </div>
      )}

      {!loading && alerts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center mb-2">
            <ShieldX size={18} className="text-emerald-400" />
          </div>
          <p className="text-xs text-slate-600">No high-risk alerts detected</p>
        </div>
      )}

      <div className="space-y-2">
        {alerts.map((item, i) => {
          const isBlock = item.decision === "BLOCK";
          return (
            <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
              className="flex items-start gap-3 p-3 rounded-xl border"
              style={{ background: isBlock ? "rgba(239,68,68,0.04)" : "rgba(245,158,11,0.04)", borderColor: isBlock ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)" }}>
              <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: isBlock ? "rgba(239,68,68,0.1)" : "rgba(245,158,11,0.1)" }}>
                {isBlock ? <ShieldX size={12} style={{ color: "#ef4444" }} /> : <AlertTriangle size={12} style={{ color: "#f59e0b" }} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-800 truncate">
                  Invoice {item.invoice_id ?? "—"} · {item.vendor_name ?? "Unknown"}
                </p>
                <p className="text-xs text-slate-600 truncate mt-0.5">{item.reason ?? "Anomaly detected"}</p>
              </div>
              <span className="text-xs font-bold shrink-0" style={{ color: isBlock ? "#ef4444" : "#f59e0b" }}>
                {(item.risk_score || 0).toFixed(0)}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
