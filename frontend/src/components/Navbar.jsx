import { useState } from "react";
import { Upload, Bell, X, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Navbar({ loading, onFileChange, alertCount }) {
  const [bellOpen, setBellOpen] = useState(false);

  const alerts = alertCount > 0 ? [
    { text: `${alertCount} invoice(s) blocked by fraud engine`, type: "error" },
    { text: "Duplicate invoice pattern detected", type: "warning" },
    { text: "High-risk vendor activity flagged", type: "warning" },
  ] : [];

  return (
    <header className="shrink-0 px-8 py-4 flex items-center justify-between border-b relative z-30"
      style={{ background: "rgba(255,255,255,0.25)", backdropFilter: "blur(24px)", borderColor: "rgba(255,255,255,0.4)" }}>

      <div>
        <h1 className="text-lg font-bold text-slate-900 leading-none">Fraud Intelligence Dashboard</h1>
        <p className="text-xs text-slate-600 mt-1">FY 2024–25 · Real-time anomaly detection engine</p>
      </div>

      <div className="flex items-center gap-3">

        {/* Upload */}
        <label className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white cursor-pointer transition-all active:scale-95 shadow-lg"
          style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 4px 15px rgba(99,102,241,0.4)" }}>
          <Upload size={14} />
          {loading ? (
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Processing...
            </span>
          ) : "Upload CSV"}
          <input type="file" accept=".csv" className="hidden" onChange={onFileChange} />
        </label>

        {/* Bell */}
        <div className="relative">
          <button onClick={() => setBellOpen(!bellOpen)}
            className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:bg-indigo-50 border border-slate-200/80 bg-white/80">
            <Bell size={16} className="text-slate-600" />
            {alertCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center">
                {alertCount > 9 ? "9+" : alertCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {bellOpen && (
              <motion.div initial={{ opacity: 0, y: 8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }} transition={{ duration: 0.15 }}
                className="absolute right-0 top-11 w-72 rounded-2xl shadow-2xl border z-[999] overflow-hidden"
                style={{ background: "rgba(255,255,255,0.95)", backdropFilter: "blur(20px)", borderColor: "rgba(99,102,241,0.15)" }}>
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                  <p className="text-sm font-semibold text-slate-800">Notifications</p>
                  <button onClick={() => setBellOpen(false)} className="text-slate-400 hover:text-slate-600">
                    <X size={14} />
                  </button>
                </div>
                {alerts.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">No alerts yet. Upload a CSV.</p>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {alerts.map((a, i) => (
                      <div key={i} className="flex items-start gap-3 px-4 py-3">
                        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${a.type === "error" ? "bg-red-500" : "bg-amber-400"}`} />
                        <p className="text-xs text-slate-600">{a.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Avatar */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold shadow"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
            FA
          </div>
          <ChevronDown size={14} className="text-slate-400" />
        </div>

      </div>
    </header>
  );
}
