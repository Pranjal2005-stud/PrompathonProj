import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Bell, X, AlertCircle, ChevronDown, Loader2 } from "lucide-react";

export default function Navbar({ loading, onFileChange, alertCount, data }) {
  const [bellOpen, setBellOpen] = useState(false);

  const alerts = (data || [])
    .filter(d => d.decision === "BLOCK" || (d.risk_score || 0) > 70)
    .slice(0, 6);

  return (
    <header
      className="shrink-0 sticky top-0 z-30 flex items-center gap-4 px-6"
      style={{
        background: "#ffffff",
        borderBottom: "1px solid #e2e8f0",
        height: "60px",
      }}
    >
      {/* Page context */}
      <div className="flex-1 min-w-0 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          <span className="text-xs text-slate-400">Real-time · FY 2024–25</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">

        {/* Upload */}
        <label
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white cursor-pointer transition-opacity hover:opacity-90 active:scale-95 shrink-0"
          style={{ background: "#2563eb" }}
        >
          {loading ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              <span>Analyzing…</span>
            </>
          ) : (
            <>
              <Upload size={14} />
              <span>Upload CSV</span>
            </>
          )}
          <input type="file" accept=".csv" className="hidden" onChange={onFileChange} />
        </label>

        {/* Bell */}
        <div className="relative">
          <button
            onClick={() => setBellOpen(o => !o)}
            className="relative w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <Bell size={16} />
            {alertCount > 0 && (
              <span
                className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
                style={{ background: "#dc2626" }}
              />
            )}
          </button>

          <AnimatePresence>
            {bellOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.97 }}
                transition={{ duration: 0.14 }}
                className="absolute right-0 top-11 w-80 z-50 rounded-xl overflow-hidden"
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
                }}
              >
                <div
                  className="flex items-center justify-between px-4 py-3 border-b"
                  style={{ borderColor: "#e2e8f0" }}
                >
                  <div className="flex items-center gap-2">
                    <AlertCircle size={14} style={{ color: "#dc2626" }} />
                    <span className="text-sm font-semibold text-slate-700">Fraud Alerts</span>
                    {alertCount > 0 && (
                      <span
                        className="text-[10px] font-semibold text-white px-1.5 py-0.5 rounded-full"
                        style={{ background: "#dc2626" }}
                      >
                        {alertCount}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setBellOpen(false)}
                    className="text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>

                {alerts.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <p className="text-sm text-slate-400">No active alerts</p>
                  </div>
                ) : (
                  <div className="max-h-60 overflow-y-auto divide-y" style={{ borderColor: "#f1f5f9" }}>
                    {alerts.map((a, i) => (
                      <div key={i} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                        <span
                          className="w-1.5 h-1.5 rounded-full mt-2 shrink-0"
                          style={{ background: a.decision === "BLOCK" ? "#dc2626" : "#d97706" }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-700 truncate">
                            Invoice {a.invoice_id}
                          </p>
                          <p className="text-xs text-slate-400 truncate mt-0.5">{a.vendor_name}</p>
                          <p className="text-xs text-slate-500 truncate mt-0.5">
                            {a.reason || "Anomaly detected"} · Risk {(a.risk_score || 0).toFixed(0)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-slate-200 mx-1" />

        {/* User */}
        <button className="flex items-center gap-2.5 hover:bg-slate-50 rounded-lg px-2 py-1.5 transition-colors">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-semibold shrink-0"
            style={{ background: "#2563eb" }}
          >
            AU
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-sm font-medium text-slate-700 leading-tight">Auditor</p>
            <p className="text-[10px] text-slate-400">Admin</p>
          </div>
          <ChevronDown size={12} className="text-slate-400" />
        </button>
      </div>
    </header>
  );
}
