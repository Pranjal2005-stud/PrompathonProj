"use client";
import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Bell, X, AlertCircle, ChevronDown, Loader2 } from "lucide-react";
import { useAppStore } from "@/store";
import { uploadInvoices } from "@/services/api";

export default function Navbar() {
  const { invoices, loading, setLoading, setError, setInvoices, addToast } = useAppStore();
  const [bellOpen, setBellOpen] = useState(false);
  const alertCount = invoices.filter((d) => d.decision === "BLOCK").length;
  const alerts = invoices.filter((d) => d.decision === "BLOCK" || (d.risk_score ?? 0) > 70).slice(0, 6);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setLoading(true);
      setError(null);
      try {
        const res = await uploadInvoices(file);
        const result = res.data;
        setInvoices(result);
        const blocked  = result.filter((d) => d.decision === "BLOCK").length;
        const critical = result.filter((d) => d.alert_level === "CRITICAL").length;
        const fraudDet = result.filter((d) => (d.risk_score ?? 0) >= 60).length;
        addToast(`${result.length} invoices analyzed`, "success");
        if (blocked  > 0) addToast(`${blocked} invoice(s) blocked`, "error");
        if (critical > 0) addToast(`${critical} CRITICAL alert(s) detected`, "error");
        if (fraudDet > 0) addToast(`${fraudDet} fraud signal(s) found`, "warning");
      } catch {
        setError("Backend unreachable. Make sure FastAPI is running on port 8000.");
        addToast("Failed to connect to backend", "error");
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError, setInvoices, addToast]
  );

  return (
    <header
      className="shrink-0 sticky top-0 z-30 flex items-center justify-between px-6 bg-white"
      style={{ borderBottom: "1px solid #e2e8f0", height: "60px", boxShadow: "0 1px 0 #f1f5f9" }}
    >
      <div className="flex items-center gap-2 shrink-0">
        <label
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white cursor-pointer hover:opacity-90 active:scale-95 shrink-0"
          style={{ background: "linear-gradient(135deg,#1d4ed8,#2563eb)", boxShadow: "0 2px 8px rgba(37,99,235,0.3)" }}
        >
          {loading ? (
            <><Loader2 size={14} className="animate-spin" /><span>Analyzing…</span></>
          ) : (
            <><Upload size={14} /><span>Upload CSV</span></>
          )}
          <input type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
        </label>

        <div className="relative">
          <button
            onClick={() => setBellOpen((o) => !o)}
            className="relative w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <Bell size={16} />
            {alertCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full animate-pulse bg-red-600" />
            )}
          </button>

          <AnimatePresence>
            {bellOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.97 }}
                transition={{ duration: 0.14 }}
                className="absolute right-0 top-11 w-80 z-50 rounded-2xl overflow-hidden bg-white"
                style={{ border: "1px solid #e2e8f0", boxShadow: "0 16px 40px rgba(0,0,0,0.12)" }}
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={14} className="text-red-600" />
                    <span className="text-sm font-semibold text-slate-700">Fraud Alerts</span>
                    {alertCount > 0 && (
                      <span className="text-[10px] font-semibold text-white px-1.5 py-0.5 rounded-full bg-red-600">
                        {alertCount}
                      </span>
                    )}
                  </div>
                  <button onClick={() => setBellOpen(false)} className="text-slate-400 hover:text-slate-600">
                    <X size={14} />
                  </button>
                </div>
                {alerts.length === 0 ? (
                  <div className="px-4 py-8 text-center"><p className="text-sm text-slate-400">No active alerts</p></div>
                ) : (
                  <div className="max-h-60 overflow-y-auto divide-y divide-slate-50">
                    {alerts.map((a, i) => (
                      <div key={i} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                        <span className="w-1.5 h-1.5 rounded-full mt-2 shrink-0 animate-pulse"
                          style={{ background: a.decision === "BLOCK" ? "#dc2626" : "#d97706" }} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-700 truncate">Invoice {a.invoice_id}</p>
                          <p className="text-xs text-slate-400 truncate mt-0.5">{a.vendor_name}</p>
                          <p className="text-xs text-slate-500 truncate mt-0.5">
                            {a.reason ?? "Anomaly detected"} · Risk {(a.risk_score ?? 0).toFixed(0)}
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

        <div className="w-px h-5 bg-slate-200 mx-1" />

        <button className="flex items-center gap-2.5 hover:bg-slate-50 rounded-xl px-2 py-1.5 transition-colors">
          <div className="w-7 h-7 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0"
            style={{ background: "linear-gradient(135deg,#2563eb,#7c3aed)" }}>
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
