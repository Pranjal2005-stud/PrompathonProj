import { useState } from "react";
import { motion } from "framer-motion";
import { Search, ChevronLeft, ChevronRight, ArrowUpDown } from "lucide-react";
import RiskBadge from "./RiskBadge";
import DecisionBadge from "./DecisionBadge";

const PAGE = 10;
const FILTERS = ["ALL", "APPROVE", "REVIEW", "BLOCK"];
const FC = {
  ALL:     { active: "#2563eb", bg: "#eff6ff"  },
  APPROVE: { active: "#059669", bg: "#f0fdf4"  },
  REVIEW:  { active: "#d97706", bg: "#fffbeb"  },
  BLOCK:   { active: "#dc2626", bg: "#fef2f2"  },
};

export default function InvoiceTable({ data = [], loading, filter, search, onFilterChange, onSearchChange, onRowClick }) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage]       = useState(1);

  const handleSort = (k) => {
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
    setPage(1);
  };

  const sorted = [...data].sort((a, b) => {
    if (!sortKey) return 0;
    const av = a[sortKey] ?? 0, bv = b[sortKey] ?? 0;
    return sortDir === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE));
  const paged = sorted.slice((page - 1) * PAGE, page * PAGE);

  const cols = [
    { key: "invoice_id",     label: "Invoice ID"  },
    { key: "vendor_name",    label: "Vendor"      },
    { key: "invoice_amount", label: "Amount"      },
    { key: "risk_score",     label: "Risk Score"  },
    { key: "reason",         label: "Fraud Flags" },
    { key: "decision",       label: "Decision"    },
  ];

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      {/* Toolbar */}
      <div
        className="px-5 py-4 border-b flex flex-wrap items-center gap-3"
        style={{ borderColor: "#e2e8f0" }}
      >
        <div>
          <p className="text-sm font-semibold text-slate-700">Invoice Analysis</p>
          <p className="text-xs text-slate-400 mt-0.5">{data.length} records</p>
        </div>

        {/* Search */}
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg ml-auto"
          style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}
        >
          <Search size={13} className="text-slate-400 shrink-0" />
          <input
            value={search}
            onChange={e => { onSearchChange(e.target.value); setPage(1); }}
            placeholder="Search invoice or vendor…"
            className="text-sm text-slate-700 bg-transparent outline-none w-48 placeholder:text-slate-400"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1.5">
          {FILTERS.map(f => {
            const isActive = filter === f;
            return (
              <button
                key={f}
                onClick={() => { onFilterChange(f); setPage(1); }}
                className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap"
                style={isActive
                  ? { background: FC[f].bg, color: FC[f].active, border: `1px solid ${FC[f].active}30` }
                  : { background: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0" }}
              >
                {f}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
            <tr>
              {cols.map(({ key, label }) => (
                <th
                  key={key}
                  onClick={() => handleSort(key)}
                  className="px-5 py-3 text-xs font-semibold text-slate-500 cursor-pointer select-none whitespace-nowrap"
                >
                  <div className="flex items-center gap-1.5">
                    {label}
                    <ArrowUpDown size={10} className="text-slate-300" />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: "#f1f5f9" }}>
            {loading && Array(5).fill(0).map((_, i) => (
              <tr key={i}>
                {cols.map((_, j) => (
                  <td key={j} className="px-5 py-4">
                    <div className="skeleton h-4 rounded" style={{ width: j === 4 ? "120px" : "72px" }} />
                  </td>
                ))}
              </tr>
            ))}

            {!loading && paged.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-400">
                  No invoices to display
                </td>
              </tr>
            )}

            {!loading && paged.map((item, i) => (
              <motion.tr
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.015 }}
                onClick={() => onRowClick?.(item)}
                className="cursor-pointer hover:bg-slate-50 transition-colors"
              >
                <td className="px-5 py-4 font-mono text-xs text-slate-500 whitespace-nowrap">
                  {item.invoice_id ?? "—"}
                </td>
                <td className="px-5 py-4 text-sm font-medium text-slate-800 whitespace-nowrap">
                  {item.vendor_name ?? "—"}
                </td>
                <td className="px-5 py-4 text-sm text-slate-700 whitespace-nowrap">
                  ₹{item.invoice_amount?.toLocaleString() ?? "—"}
                </td>
                <td className="px-5 py-4">
                  <RiskBadge score={item.risk_score} />
                </td>
                <td className="px-5 py-4 text-xs text-slate-500 max-w-[200px]">
                  <span className="truncate block" title={item.reason ?? ""}>
                    {item.reason ?? "—"}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <DecisionBadge decision={item.decision} />
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          className="flex items-center justify-between px-5 py-3.5 border-t"
          style={{ borderColor: "#e2e8f0" }}
        >
          <p className="text-xs text-slate-400">
            Showing {(page - 1) * PAGE + 1}–{Math.min(page * PAGE, sorted.length)} of {sorted.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className="w-8 h-8 rounded-lg text-xs font-medium transition-colors"
                  style={page === p
                    ? { background: "#2563eb", color: "#ffffff" }
                    : { color: "#64748b" }}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
