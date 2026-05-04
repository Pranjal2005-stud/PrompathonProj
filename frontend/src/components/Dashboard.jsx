import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { uploadInvoices } from "../services/api";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import MetricCard from "./MetricCard";
import Charts from "./Charts";
import InvoiceTable from "./InvoiceTable";
import InvoiceDrawer from "./InvoiceDrawer";
import AlertsPanel from "./AlertsPanel";
import VendorHeatmap from "./VendorHeatmap";
import ToastContainer from "./ToastContainer";

export default function Dashboard() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const toastId = useRef(0);

  const addToast = (message, type = "error") => {
    const id = toastId.current++;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const res = await uploadInvoices(file);
      const result = res.data;
      setData(result);
      const blocked = result.filter((d) => d.decision === "BLOCK").length;
      const highRisk = result.filter((d) => (d.risk_score || 0) > 80).length;
      if (blocked > 0) addToast(`🚨 ${blocked} invoice(s) blocked by fraud engine`, "error");
      if (highRisk > 0) addToast(`⚠️ ${highRisk} high-risk invoice(s) detected`, "warning");
      addToast(`✅ ${result.length} invoices processed successfully`, "success");
    } catch {
      setError("Backend unreachable. Make sure FastAPI is running on port 8000.");
      addToast("❌ Failed to connect to backend", "error");
    } finally {
      setLoading(false);
    }
  };

  const total = data.length;
  const blocked = data.filter((d) => d.decision === "BLOCK").length;
  const review = data.filter((d) => d.decision === "REVIEW").length;
  const approved = data.filter((d) => d.decision === "APPROVE").length;
  const avgRisk = (data.reduce((sum, d) => sum + (d.risk_score || 0), 0) / (total || 1)).toFixed(1);
  const totalAmount = data.reduce((sum, d) => sum + (d.invoice_amount || 0), 0);
  const fraudRate = total > 0 ? ((blocked / total) * 100).toFixed(1) : "0.0";

  const metrics = [
    { title: "Total Invoices", value: total, icon: "file", sub: "Processed", accent: "blue" },
    { title: "Blocked", value: blocked, icon: "block", sub: `${fraudRate}% fraud rate`, accent: "red" },
    { title: "Under Review", value: review, icon: "review", sub: "Needs attention", accent: "amber" },
    { title: "Approved", value: approved, icon: "approve", sub: "Clean invoices", accent: "emerald" },
    { title: "Avg Risk Score", value: avgRisk, icon: "risk", sub: "Out of 100", accent: "violet" },
    { title: "Total Processed", value: `₹${(totalAmount / 1000).toFixed(1)}K`, icon: "amount", sub: "Invoice value", accent: "sky" },
  ];

  const filteredData = data
    .filter((d) => filter === "ALL" || d.decision === filter)
    .filter((d) =>
      search === "" ||
      (d.invoice_id?.toString().toLowerCase().includes(search.toLowerCase())) ||
      (d.vendor_name?.toLowerCase().includes(search.toLowerCase()))
    );

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "linear-gradient(135deg, #dbeafe 0%, #eff6ff 35%, #eef2ff 65%, #ede9fe 100%)" }}>
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar loading={loading} onFileChange={handleFileChange} alertCount={blocked} />

        <main className="flex-1 overflow-y-auto px-8 py-6 space-y-7">

          {error && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm flex items-center gap-2">
              ❌ {error}
            </motion.div>
          )}

          {/* KPI Cards */}
          <div className="grid grid-cols-6 gap-4">
            {metrics.map((m, i) => (
              <motion.div key={m.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
                <MetricCard {...m} loading={loading} />
              </motion.div>
            ))}
          </div>

          {/* Charts Row */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Charts data={data} loading={loading} />
          </motion.div>

          {/* Alerts + Heatmap */}
          {(data.length > 0 || loading) && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
              className="grid grid-cols-5 gap-6">
              <div className="col-span-2"><AlertsPanel data={data} loading={loading} /></div>
              <div className="col-span-3"><VendorHeatmap data={data} loading={loading} /></div>
            </motion.div>
          )}

          {/* Invoice Table */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <InvoiceTable
              data={filteredData}
              loading={loading}
              filter={filter}
              search={search}
              onFilterChange={setFilter}
              onSearchChange={setSearch}
              onRowClick={setSelectedInvoice}
            />
          </motion.div>

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
