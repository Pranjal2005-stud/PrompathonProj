import { useState } from "react";
import { ArrowUpDown, Search, SlidersHorizontal } from "lucide-react";
import { motion } from "framer-motion";
import RiskBadge from "./RiskBadge";
import DecisionBadge from "./DecisionBadge";

const CARD = { background: "rgba(255,255,255,0.25)", backdropFilter: "blur(24px)", borderColor: "rgba(255,255,255,0.5)", boxShadow: "0 4px 24px rgba(99,102,241,0.08)" };
const PAGE_SIZE = 10;

export default function InvoiceTable({ data = [], loading, filter, search, onFilterChange, onSearchChange, onRowClick }) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(1);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
    setPage(1);
  };

  const sorted = [...data].sort((a, b) => {
    if (!sortKey) return 0;
    const av = a[sortKey] ?? 0, bv = b[sortKey] ?? 0;
    return sortDir === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const cols = [
    { key: "invoice_id", label: "Invoice ID" },
    { key: "vendor_name", label: "Vendor" },
    { key: "invoice_amount", label: "Amount" },
    { key: "risk_score", label: "Risk Score" },
    { key: "decision", label: "Decision" },
    { key: "reason", label: "Reason" },
  ];

  const FILTERS = ["ALL", "APPROVE", "REVIEW", "BLOCK"];
  const filterColors = { ALL: "#6366f1", APPROVE: "#10b981", REVIEW: "#f59e0b", BLOCK: "#ef4444" };

  return (
    <div className="rounded-2xl border overflow-hidden" style={CARD}>

      {/* Table Header */}
      <div className="px-6 py-4 border-b flex items-center gap-4 flex-wrap" style={{ borderColor: "rgba(0,0,0,0.05)" }}>
        <div>
          <p className="text-sm font-semibold text-slate-700">Invoice Analysis</p>
          <p className="text-xs text-slate-400">{data.length} records</p>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border ml-auto" style={{ background: "rgba(255,255,255,0.4)", borderColor: "rgba(99,102,241,0.15)" }}>
          <Search size={13} className="text-slate-400" />
          <input value={search} onChange={(e) => { onSearchChange(e.target.value); setPage(1); }}
            placeholder="Search invoice or vendor..."
            className="text-xs text-slate-700 bg-transparent outline-none w-44 placeholder:text-slate-400" />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1.5">
          <SlidersHorizontal size={13} className="text-slate-400" />
          {FILTERS.map((f) => (
            <button key={f} onClick={() => { onFilterChange(f); setPage(1); }}
              className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
              style={filter === f
                ? { background: filterColors[f], color: "white", boxShadow: `0 2px 8px ${filterColors[f]}40` }
                : { background: "rgba(255,255,255,0.4)", color: "#334155", border: "1px solid rgba(99,102,241,0.15)" }}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Skeleton */}
      {loading && (
        <div className="p-4 space-y-2">
          {Array(5).fill(0).map((_, i) => <div key={i} className="h-12 rounded-xl bg-slate-100 animate-pulse" />)}
        </div>
      )}

      {/* Empty */}
      {!loading && data.length === 0 && (
        <div className="py-16 text-center">
          <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: "rgba(99,102,241,0.08)" }}>
            <Search size={20} style={{ color: "#6366f1" }} />
          </div>
          <p className="text-sm text-slate-700 font-medium">No invoices yet</p>
          <p className="text-xs text-slate-500 mt-1">Upload a CSV file to get started</p>
        </div>
      )}

      {/* Table */}
      {!loading && data.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead style={{ background: "rgba(255,255,255,0.3)", borderBottom: "1px solid rgba(99,102,241,0.1)" }}>
                <tr>
                  {cols.map(({ key, label }) => (
                    <th key={key} onClick={() => handleSort(key)}
                      className="px-5 py-3 text-xs font-semibold text-slate-700 uppercase tracking-wide cursor-pointer hover:text-indigo-600 select-none transition-colors">
                      <div className="flex items-center gap-1">
                        {label}
                        <ArrowUpDown size={10} className={sortKey === key ? "text-indigo-500" : "text-slate-300"} />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map((item, i) => (
                  <motion.tr key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                    onClick={() => onRowClick?.(item)}
                    className="border-b cursor-pointer transition-all hover:bg-indigo-50/60"
                    style={{ borderColor: "rgba(0,0,0,0.04)" }}>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-600">{item.invoice_id ?? "—"}</td>
                    <td className="px-5 py-3.5 font-semibold text-slate-900">{item.vendor_name ?? "—"}</td>
                    <td className="px-5 py-3.5 text-slate-700 font-medium">₹{item.invoice_amount?.toLocaleString() ?? "—"}</td>
                    <td className="px-5 py-3.5"><RiskBadge score={item.risk_score} /></td>
                    <td className="px-5 py-3.5"><DecisionBadge decision={item.decision} /></td>
                    <td className="px-5 py-3.5 text-slate-600 text-xs max-w-[160px] truncate">{item.reason ?? "—"}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-3 flex items-center justify-between border-t" style={{ borderColor: "rgba(0,0,0,0.05)" }}>
            <p className="text-xs text-slate-400">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sorted.length)} of {sorted.length}
            </p>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 7).map((p) => (
                <button key={p} onClick={() => setPage(p)}
                  className="w-7 h-7 rounded-lg text-xs font-medium transition-all"
                  style={page === p
                    ? { background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "white" }
                    : { color: "#64748b", background: "transparent" }}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
