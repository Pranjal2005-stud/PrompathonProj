"use client";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, RotateCcw, AlertCircle, ClipboardList, Search } from "lucide-react";
import { useMemo, useState, memo } from "react";
import { useAppStore } from "@/store";
import { DEMO_DATA } from "@/lib/demo-data";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import MetricCard from "@/components/MetricCard";
import InvoiceTable from "@/components/InvoiceTable";
import ToastContainer from "@/components/ToastContainer";
import { Skeleton } from "@/components/ui/primitives";
import type { Invoice } from "@/types";

// Dynamic imports for heavy components
const Charts       = dynamic(() => import("@/components/Charts"),       { ssr: false, loading: () => <div className="grid grid-cols-3 gap-5">{[1,2,3].map(i=><Skeleton key={i} className="h-64"/>)}</div> });
const AlertsPanel  = dynamic(() => import("@/components/AlertsPanel"),  { ssr: false, loading: () => <Skeleton className="h-96 rounded-2xl"/> });
const VendorHeatmap= dynamic(() => import("@/components/VendorHeatmap"),{ ssr: false, loading: () => <Skeleton className="h-72 rounded-2xl"/> });
const InvoiceDrawer= dynamic(() => import("@/components/InvoiceDrawer"),{ ssr: false });
const AICopilot    = dynamic(() => import("@/components/AICopilot"),    { ssr: false });

// ── Investigation Queue ───────────────────────────────────────────────────────
const InvestigationQueue = memo(function InvestigationQueue() {
  const { invoices, setSelectedInvoice } = useAppStore();
  const queue = useMemo(() =>
    invoices.filter((d) => d.decision !== "APPROVE")
      .sort((a, b) => (b.risk_score ?? 0) - (a.risk_score ?? 0))
      .slice(0, 25),
    [invoices]
  );
  const LEVEL_COLORS: Record<string, { color: string; bg: string; border: string }> = {
    CRITICAL: { color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
    HIGH:     { color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
    MEDIUM:   { color: "#ea580c", bg: "#fff7ed", border: "#fed7aa" },
    LOW:      { color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
  };
  return (
    <div className="rounded-2xl p-5 bg-white" style={{ border: "1px solid #e2e8f0", boxShadow: "var(--card-shadow)" }}>
      <div className="flex items-center gap-2 mb-4">
        <ClipboardList size={15} className="text-red-600" />
        <p className="text-sm font-semibold text-slate-700">Investigation Queue</p>
        <span className="text-[10px] font-bold text-white px-2 py-0.5 rounded-full bg-red-600">{queue.length} pending</span>
      </div>
      {queue.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">No invoices require investigation</p>
      ) : (
        <div className="space-y-2">
          {queue.map((item, i) => {
            const lc = LEVEL_COLORS[item.alert_level ?? "HIGH"] ?? LEVEL_COLORS.HIGH;
            return (
              <motion.div key={i}
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                onClick={() => setSelectedInvoice(item)}
                className="flex items-center gap-4 p-4 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors"
                style={{ border: "1px solid #e2e8f0" }}
              >
                <span className="text-sm font-bold text-slate-300 w-6 shrink-0 text-center">#{i + 1}</span>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: lc.bg }}>
                  <span className="text-xs font-bold" style={{ color: lc.color }}>{(item.risk_score ?? 0).toFixed(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-lg shrink-0"
                      style={{ background: lc.bg, color: lc.color, border: `1px solid ${lc.border}` }}>
                      {item.alert_level ?? "HIGH"}
                    </span>
                    <p className="text-sm font-semibold text-slate-800 truncate">{item.vendor_name}</p>
                  </div>
                  <p className="text-xs text-slate-500 truncate">{item.fraud_type ?? item.rule_flags ?? "Anomaly"}</p>
                </div>
                <div className="text-right shrink-0 min-w-[60px]">
                  <p className="text-sm font-bold" style={{ color: lc.color }}>{item.decision}</p>
                  <p className="text-xs text-slate-400">{item.invoice_amount ? `₹${Number(item.invoice_amount).toLocaleString("en-IN")}` : "—"}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
});

// ── Forensic Search ───────────────────────────────────────────────────────────
const ForensicSearch = memo(function ForensicSearch() {
  const { invoices, setSelectedInvoice } = useAppStore();
  const [q, setQ] = useState("");
  const results = useMemo(() =>
    q.length > 1
      ? invoices.filter((d) =>
          String(d.invoice_id ?? "").toLowerCase().includes(q.toLowerCase()) ||
          (d.vendor_name ?? "").toLowerCase().includes(q.toLowerCase()) ||
          (d.rule_flags ?? d.reason ?? "").toLowerCase().includes(q.toLowerCase()) ||
          (d.fraud_type ?? "").toLowerCase().includes(q.toLowerCase())
        ).slice(0, 15)
      : [],
    [q, invoices]
  );
  return (
    <div className="rounded-2xl p-5 bg-white" style={{ border: "1px solid #e2e8f0" }}>
      <div className="flex items-center gap-2 mb-4">
        <Search size={15} className="text-blue-600" />
        <p className="text-sm font-semibold text-slate-700">Forensic Search</p>
      </div>
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl mb-4" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
        <Search size={13} className="text-slate-400 shrink-0" />
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search by invoice ID, vendor, fraud type, or flag…"
          className="flex-1 text-sm text-slate-700 bg-transparent outline-none placeholder:text-slate-400" />
      </div>
      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((item, i) => (
            <div key={i} onClick={() => setSelectedInvoice(item)}
              className="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors"
              style={{ border: "1px solid #f1f5f9" }}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700">{item.vendor_name} <span className="text-xs text-slate-400 font-mono">#{item.invoice_id}</span></p>
                <p className="text-xs text-slate-400 truncate">{item.fraud_type ?? item.rule_flags ?? "Normal"}</p>
              </div>
              <span className="text-xs font-semibold px-2 py-1 rounded-full"
                style={{ background: (item.risk_score ?? 0) > 65 ? "#fef2f2" : "#fffbeb", color: (item.risk_score ?? 0) > 65 ? "#dc2626" : "#d97706" }}>
                {(item.risk_score ?? 0).toFixed(0)}
              </span>
            </div>
          ))}
        </div>
      )}
      {q.length > 1 && results.length === 0 && <p className="text-sm text-slate-400 text-center py-6">No results for &quot;{q}&quot;</p>}
    </div>
  );
});

// ── Main Shell ────────────────────────────────────────────────────────────────
export default function AppShell() {
  const {
    invoices, loading, error, activePage, selectedInvoice,
    setInvoices, addToast, reset,
  } = useAppStore();

  const { total, fraudDetected, blocked, review, fraudRate, amountSaved } = useMemo(() => {
    const total         = invoices.length;
    const fraudDetected = invoices.filter((d) => (d.risk_score ?? 0) >= 60).length;
    const blocked       = invoices.filter((d) => d.decision === "BLOCK").length;
    const review        = invoices.filter((d) => d.decision === "REVIEW").length;
    const fraudRate     = total > 0 ? ((fraudDetected / total) * 100).toFixed(1) : "0.0";
    const amountSaved   = invoices.filter((d) => d.decision === "BLOCK").reduce((s, d) => s + (d.invoice_amount ?? 0), 0);
    return { total, fraudDetected, blocked, review, fraudRate, amountSaved };
  }, [invoices]);

  const PAGE_META: Record<string, { title: string; subtitle: string }> = {
    dashboard: { title: "Command Center",      subtitle: total > 0 ? `${total} invoices · ${blocked} blocked · ${review} under review` : "Upload a CSV to begin fraud analysis" },
    invoices:  { title: "Invoice Monitoring",  subtitle: `${total} invoices loaded` },
    alerts:    { title: "Live Fraud Alerts",   subtitle: `${blocked} blocked · ${review} under review` },
    vendors:   { title: "Vendor Intelligence", subtitle: "Risk heatmap across all vendors" },
    analytics: { title: "Fraud Analytics",     subtitle: "Deep-dive fraud pattern analysis" },
    queue:     { title: "Investigation Queue", subtitle: `${invoices.filter((d) => d.decision !== "APPROVE").length} cases pending` },
    forensic:  { title: "Forensic Search",     subtitle: "Search across all invoice data" },
    settings:  { title: "Settings",            subtitle: "Platform configuration" },
  };
  const meta = PAGE_META[activePage] ?? PAGE_META.dashboard;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--page-bg)" }}>
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Navbar />

        <main className="flex-1 overflow-y-auto px-8 py-7">
          {error && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm mb-6"
              style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
              <AlertCircle size={14} /> {error}
            </motion.div>
          )}

          {/* Page header */}
          <div className="flex items-start justify-between gap-4 mb-7">
            <div>
              <h1 className="text-xl font-semibold text-slate-800">{meta.title}</h1>
              {meta.subtitle && <p className="text-sm text-slate-400 mt-1">{meta.subtitle}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => { setInvoices(DEMO_DATA); addToast("Demo data loaded", "warning"); }}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap"
                style={{ color: "#d97706", border: "1px solid #fde68a", background: "#fffbeb" }}>
                <Zap size={13} /> Demo Data
              </button>
              {invoices.length > 0 && (
                <button onClick={reset}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap"
                  style={{ color: "#64748b", border: "1px solid #e2e8f0", background: "#f8fafc" }}>
                  <RotateCcw size={13} /> Reset
                </button>
              )}
            </div>
          </div>

          {/* ── Page content ── */}
          {activePage === "alerts" && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              style={{ height: "calc(100vh - 180px)", minHeight: 520 }}>
              <AlertsPanel />
            </motion.div>
          )}
          {activePage === "vendors" && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <VendorHeatmap />
            </motion.div>
          )}
          {activePage === "reports" && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl p-8 text-center bg-white" style={{ border: "1px solid #e2e8f0" }}>
              <p className="text-slate-400 text-sm">Reports — use Export PDF from sidebar</p>
            </motion.div>
          )}
          {activePage === "analytics" && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <Charts />
            </motion.div>
          )}
          {activePage === "queue" && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className="max-w-3xl mx-auto">
              <InvestigationQueue />
            </motion.div>
          )}
          {activePage === "forensic" && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <ForensicSearch />
            </motion.div>
          )}
          {activePage === "settings" && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl p-8 text-center bg-white" style={{ border: "1px solid #e2e8f0" }}>
              <p className="text-slate-400 text-sm">Settings panel — coming soon</p>
            </motion.div>
          )}

          {(activePage === "dashboard" || activePage === "invoices") && (
            <div className="space-y-6">
              {/* 4 KPI cards */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-4 gap-5">
                {[
                  { type: "invoices" as const, title: "Total Invoices",   value: total,         sub: "Processed this session"    },
                  { type: "blocked"  as const, title: "Fraud Detected",   value: fraudDetected, sub: `${fraudRate}% · risk ≥ 60` },
                  { type: "vendors"  as const, title: "Blocked Payments", value: blocked,       sub: "Payments stopped"          },
                  { type: "saved"    as const, title: "Amount Saved",     value: amountSaved,   sub: "₹ leakage prevented", prefix: "₹" },
                ].map((m, i) => (
                  <motion.div key={m.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
                    <MetricCard {...m} loading={loading} />
                  </motion.div>
                ))}
              </motion.div>

              {activePage === "dashboard" && (
                <>
                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                    <Charts />
                  </motion.div>
                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
                    className="grid gap-5" style={{ gridTemplateColumns: "1fr 1fr", minHeight: "460px", height: "460px" }}>
                    <AlertsPanel />
                    <VendorHeatmap />
                  </motion.div>
                </>
              )}

              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                <InvoiceTable />
              </motion.div>
            </div>
          )}
        </main>
      </div>

      {/* Forensic modal */}
      <AnimatePresence>{selectedInvoice && <InvoiceDrawer />}</AnimatePresence>

      {/* Floating AI Copilot */}
      <AICopilot />

      <ToastContainer />
    </div>
  );
}
