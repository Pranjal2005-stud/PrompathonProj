import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { uploadInvoices } from "../services/api";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import MetricCard from "./MetricCard";
import Charts from "./Charts";
import AlertsPanel from "./AlertsPanel";
import VendorHeatmap from "./VendorHeatmap";
import InvoiceTable from "./InvoiceTable";
import InvoiceDrawer from "./InvoiceDrawer";
import AICopilot from "./AICopilot";
import ToastContainer from "./ToastContainer";
import { Zap, RotateCcw, AlertCircle } from "lucide-react";

const FRAUD_SCENARIOS = [
  { invoice_id: "SIM-001", vendor_name: "Ghost Vendor Ltd",  invoice_amount: 950000,  approved_amount_po: 0,     paid_amount: 0,     quantity: 1, approved_quantity_po: 1, invoice_date: "2024-01-15", decision: "BLOCK",  risk_score: 97, reason: "Missing PO, Overbilling, Duplicate Pattern", anomaly_score: -0.8  },
  { invoice_id: "SIM-002", vendor_name: "Vendor_1",          invoice_amount: 85000,   approved_amount_po: 50000, paid_amount: 90000, quantity: 5, approved_quantity_po: 3, invoice_date: "2024-01-15", decision: "BLOCK",  risk_score: 88, reason: "Overbilling, Overpayment, High Deviation",      anomaly_score: -0.6  },
  { invoice_id: "SIM-003", vendor_name: "Vendor_1",          invoice_amount: 85000,   approved_amount_po: 50000, paid_amount: 90000, quantity: 5, approved_quantity_po: 3, invoice_date: "2024-01-15", decision: "BLOCK",  risk_score: 85, reason: "Duplicate Pattern, Overbilling",               anomaly_score: -0.55 },
  { invoice_id: "SIM-004", vendor_name: "Benchmark Corp",    invoice_amount: 120000,  approved_amount_po: 80000, paid_amount: 0,     quantity: 2, approved_quantity_po: 2, invoice_date: "2024-01-16", decision: "REVIEW", risk_score: 62, reason: "High Deviation, Overpriced vs Benchmark",      anomaly_score: -0.3  },
];

function formatCurrency(amount) {
  if (amount >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(1)}Cr`;
  if (amount >= 100_000)    return `₹${(amount / 100_000).toFixed(1)}L`;
  if (amount >= 1_000)      return `₹${(amount / 1_000).toFixed(0)}K`;
  return `₹${amount}`;
}

function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-7">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">{title}</h1>
        {subtitle && <p className="text-sm text-slate-400 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export default function Dashboard() {
  const [data, setData]                       = useState([]);
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [toasts, setToasts]                   = useState([]);
  const [filter, setFilter]                   = useState("ALL");
  const [search, setSearch]                   = useState("");
  const [activePage, setActivePage]           = useState("dashboard");
  const toastId = useRef(0);

  const addToast = (message, type = "info") => {
    const id = toastId.current++;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const res    = await uploadInvoices(file);
      const result = res.data;
      setData(result);
      const blocked  = result.filter(d => d.decision === "BLOCK").length;
      const highRisk = result.filter(d => (d.risk_score || 0) > 80).length;
      addToast(`${result.length} invoices analyzed successfully`, "success");
      if (blocked  > 0) addToast(`${blocked} invoice(s) blocked by fraud engine`, "error");
      if (highRisk > 0) addToast(`${highRisk} high-risk invoice(s) detected`, "warning");
    } catch {
      setError("Backend unreachable. Make sure FastAPI is running on port 8000.");
      addToast("Failed to connect to backend", "error");
    } finally {
      setLoading(false);
    }
  };

  const injectFraud = () => {
    setData(prev => [...FRAUD_SCENARIOS, ...prev]);
    addToast("Fraud scenario injected — dashboard updated", "warning");
  };

  const total            = data.length;
  const blocked          = data.filter(d => d.decision === "BLOCK").length;
  const review           = data.filter(d => d.decision === "REVIEW").length;
  const avgRisk          = (data.reduce((s, d) => s + (d.risk_score || 0), 0) / (total || 1)).toFixed(1);
  const fraudRate        = total > 0 ? ((blocked / total) * 100).toFixed(1) : "0.0";
  const leakagePrevented = data.filter(d => d.decision === "BLOCK").reduce((s, d) => s + (d.invoice_amount || 0), 0);
  const vendorsFlagged   = new Set(data.filter(d => d.decision === "BLOCK").map(d => d.vendor_name)).size;

  const filteredData = data
    .filter(d => filter === "ALL" || d.decision === filter)
    .filter(d =>
      search === "" ||
      (d.invoice_id?.toString().toLowerCase().includes(search.toLowerCase())) ||
      (d.vendor_name?.toLowerCase().includes(search.toLowerCase()))
    );

  const metrics = [
    { type: "invoices", title: "Total Invoices",   value: total,                        sub: "Processed this session"   },
    { type: "blocked",  title: "Fraud Detected",    value: blocked,                      sub: `${fraudRate}% fraud rate` },
    { type: "leakage",  title: "Leakage Prevented", value: formatCurrency(leakagePrevented), sub: "Blocked invoice value" },
    { type: "vendors",  title: "Vendors Flagged",    value: vendorsFlagged,               sub: "Unique risky vendors"     },
    { type: "risk",     title: "Avg Risk Score",     value: avgRisk,                      sub: "Out of 100"               },
    { type: "ai",       title: "AI Confidence",      value: "78%",                        sub: "Model accuracy"           },
  ];

  const PAGE_META = {
    dashboard: { title: "Overview",            subtitle: total > 0 ? `${total} invoices analyzed · ${blocked} blocked · ${review} under review` : "Upload a CSV file to begin AI-powered fraud analysis" },
    invoices:  { title: "Invoice Analysis",    subtitle: `${total} invoices · ${filteredData.length} shown` },
    alerts:    { title: "Live Fraud Alerts",   subtitle: `${blocked} active alerts requiring attention` },
    vendors:   { title: "Vendor Intelligence", subtitle: "Risk heatmap across all vendors" },
    copilot:   { title: "AI Fraud Copilot",    subtitle: "Ask questions about your invoice data" },
  };

  const meta = PAGE_META[activePage] || PAGE_META.dashboard;

  const actionBar = (
    <>
      <button
        onClick={injectFraud}
        className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-amber-50 whitespace-nowrap"
        style={{ color: "#d97706", border: "1px solid #fde68a", background: "#fffbeb" }}
      >
        <Zap size={13} />
        Demo Data
      </button>
      {data.length > 0 && (
        <button
          onClick={() => { setData([]); setFilter("ALL"); setSearch(""); }}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-slate-100 whitespace-nowrap"
          style={{ color: "#64748b", border: "1px solid #e2e8f0", background: "#f8fafc" }}
        >
          <RotateCcw size={13} />
          Reset
        </button>
      )}
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#f8fafc" }}>
      <Sidebar active={activePage} onNav={setActivePage} alertCount={blocked} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Navbar loading={loading} onFileChange={handleFileChange} alertCount={blocked} data={data} />

        <main className="flex-1 overflow-y-auto px-8 py-7">

          {/* Error banner */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2.5 px-4 py-3 rounded-lg text-sm mb-6"
              style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}
            >
              <AlertCircle size={14} />
              {error}
            </motion.div>
          )}

          <PageHeader title={meta.title} subtitle={meta.subtitle} actions={actionBar} />

          {/* ── AI Copilot ── */}
          {activePage === "copilot" && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <AICopilot data={data} />
            </motion.div>
          )}

          {/* ── Alerts ── */}
          {activePage === "alerts" && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ height: "580px" }}>
              <AlertsPanel data={data} loading={loading} onSelect={setSelectedInvoice} />
            </motion.div>
          )}

          {/* ── Vendors ── */}
          {activePage === "vendors" && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <VendorHeatmap data={data} loading={loading} />
            </motion.div>
          )}

          {/* ── Dashboard / Invoices ── */}
          {(activePage === "dashboard" || activePage === "invoices") && (
            <div className="space-y-7">

              {/* KPI row */}
              <motion.div
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4"
              >
                {metrics.map((m, i) => (
                  <motion.div key={m.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <MetricCard {...m} loading={loading} />
                  </motion.div>
                ))}
              </motion.div>

              {/* Charts */}
              {activePage !== "invoices" && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                  <Charts data={data} loading={loading} />
                </motion.div>
              )}

              {/* Alerts + Heatmap */}
              {activePage !== "invoices" && (data.length > 0 || loading) && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
                  className="grid grid-cols-5 gap-5"
                  style={{ minHeight: "280px" }}
                >
                  <div className="col-span-2 flex flex-col">
                    <AlertsPanel data={data} loading={loading} onSelect={setSelectedInvoice} />
                  </div>
                  <div className="col-span-3 flex flex-col">
                    <VendorHeatmap data={data} loading={loading} />
                  </div>
                </motion.div>
              )}

              {/* Invoice Table */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                <InvoiceTable
                  data={filteredData} loading={loading}
                  filter={filter} search={search}
                  onFilterChange={setFilter} onSearchChange={setSearch}
                  onRowClick={setSelectedInvoice}
                />
              </motion.div>

            </div>
          )}

        </main>
      </div>

      <AnimatePresence>
        {selectedInvoice && (
          <InvoiceDrawer invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} />
        )}
      </AnimatePresence>

      <ToastContainer toasts={toasts} />
    </div>
  );
}
