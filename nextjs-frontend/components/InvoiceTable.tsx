"use client";
import { useState, useMemo, memo } from "react";
import { motion } from "framer-motion";
import { Search, ChevronLeft, ChevronRight, ArrowUpDown, Download } from "lucide-react";
import { useAppStore } from "@/store";
import { exportCSV } from "@/lib/utils";
import { RiskBadge, DecisionBadge } from "@/components/ui/primitives";

const PAGE = 10;
const FILTERS = ["ALL", "APPROVE", "REVIEW", "BLOCK"] as const;
const FC: Record<string, { active: string; bg: string }> = {
  ALL:     { active: "#2563eb", bg: "#eff6ff" },
  APPROVE: { active: "#059669", bg: "#f0fdf4" },
  REVIEW:  { active: "#d97706", bg: "#fffbeb" },
  BLOCK:   { active: "#dc2626", bg: "#fef2f2" },
};
const ROW_TINT: Record<string, string> = {
  BLOCK:   "rgba(220,38,38,0.04)",
  REVIEW:  "rgba(217,119,6,0.04)",
  APPROVE: "transparent",
};

const COLS = [
  { key: "invoice_id",         label: "Invoice ID"   },
  { key: "vendor_name",        label: "Vendor"       },
  { key: "invoice_amount",     label: "Amount"       },
  { key: "risk_score",         label: "Risk Score"   },
  { key: "fraud_type",         label: "Fraud Type"   },
  { key: "decision",           label: "Decision"     },
  { key: "network_risk_score", label: "Network Risk" },
  { key: "rule_flags",         label: "Flags"        },
] as const;

const InvoiceTable = memo(function InvoiceTable() {
  const { invoices, loading, filter, search, setFilter, setSearch, setSelectedInvoice } = useAppStore();
  const [sortKey, setSortKey] = useState<string>("risk_score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage]       = useState(1);

  const handleSort = (k: string) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("desc"); }
    setPage(1);
  };

  const { sorted, paged, totalPages } = useMemo(() => {
    const filtered = invoices
      .filter((d) => filter === "ALL" || d.decision === filter)
      .filter((d) => search === "" ||
        String(d.invoice_id ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (d.vendor_name ?? "").toLowerCase().includes(search.toLowerCase())
      );
    const s = [...filtered].sort((a, b) => {
      const av = (a as unknown as Record<string, unknown>)[sortKey] ?? 0;
      const bv = (b as unknown as Record<string, unknown>)[sortKey] ?? 0;
      return sortDir === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
    const tp = Math.max(1, Math.ceil(s.length / PAGE));
    const pg = s.slice((page - 1) * PAGE, page * PAGE);
    return { sorted: s, paged: pg, totalPages: tp };
  }, [invoices, filter, search, sortKey, sortDir, page]);

  return (
    <div className="rounded-2xl overflow-hidden bg-white" style={{ border: "1px solid #e2e8f0", boxShadow: "var(--card-shadow)" }}>
      <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-700">Invoice Analysis</p>
          <p className="text-xs text-slate-400 mt-0.5">{sorted.length} records</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl ml-auto" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
          <Search size={13} className="text-slate-400 shrink-0" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search invoice or vendor…"
            className="text-sm text-slate-700 bg-transparent outline-none w-44 placeholder:text-slate-400" />
        </div>
        <div className="flex items-center gap-1.5">
          {FILTERS.map((f) => {
            const isActive = filter === f;
            return (
              <button key={f} onClick={() => { setFilter(f); setPage(1); }}
                className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap"
                style={isActive ? { background: FC[f].bg, color: FC[f].active, border: `1px solid ${FC[f].active}30` } : { background: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0" }}>
                {f}
              </button>
            );
          })}
        </div>
        <button onClick={() => exportCSV(sorted)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-100 transition-colors"
          style={{ color: "#64748b", border: "1px solid #e2e8f0" }}>
          <Download size={12} /> Export CSV
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
            <tr>
              {COLS.map(({ key, label }) => (
                <th key={key} onClick={() => handleSort(key)}
                  className="px-4 py-3 text-xs font-semibold text-slate-500 cursor-pointer select-none whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    {label}
                    <ArrowUpDown size={10} className={sortKey === key ? "text-blue-500" : "text-slate-300"} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading && Array(5).fill(0).map((_, i) => (
              <tr key={i}>{COLS.map((_, j) => <td key={j} className="px-4 py-4"><div className="skeleton h-4 rounded" style={{ width: j === 7 ? "120px" : "72px" }} /></td>)}</tr>
            ))}
            {!loading && paged.length === 0 && (
              <tr><td colSpan={COLS.length} className="px-5 py-12 text-center text-sm text-slate-400">No invoices to display</td></tr>
            )}
            {!loading && paged.map((item, i) => {
              const tint = ROW_TINT[item.decision] ?? "transparent";
              const flags = item.rule_flags ?? item.reason ?? "—";
              return (
                <motion.tr key={i}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.015 }}
                  onClick={() => setSelectedInvoice(item)}
                  className="cursor-pointer hover:bg-slate-50 transition-colors"
                  style={{ background: tint }}
                >
                  <td className="px-4 py-3.5 font-mono text-xs text-slate-500 whitespace-nowrap">{item.invoice_id ?? "—"}</td>
                  <td className="px-4 py-3.5 text-sm font-medium text-slate-800 whitespace-nowrap">{item.vendor_name ?? "—"}</td>
                  <td className="px-4 py-3.5 text-sm text-slate-700 whitespace-nowrap">₹{item.invoice_amount?.toLocaleString() ?? "—"}</td>
                  <td className="px-4 py-3.5"><RiskBadge score={item.risk_score} /></td>
                  <td className="px-4 py-3.5">
                    {item.fraud_type && item.fraud_type !== "Normal"
                      ? <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ background: "#f5f3ff", color: "#7c3aed", border: "1px solid #ddd6fe" }}>{item.fraud_type.replace(" Fraud", "")}</span>
                      : <span className="text-xs text-slate-400">Normal</span>}
                  </td>
                  <td className="px-4 py-3.5"><DecisionBadge decision={item.decision} /></td>
                  <td className="px-4 py-3.5 text-xs text-slate-500">
                    {item.network_risk_score != null
                      ? <span className="font-semibold" style={{ color: (item.network_risk_score ?? 0) > 50 ? "#dc2626" : "#64748b" }}>{Number(item.network_risk_score).toFixed(0)}</span>
                      : "—"}
                  </td>
                  <td className="px-4 py-3.5 text-xs text-slate-500 max-w-[180px]">
                    <span className="truncate block" title={flags}>{flags}</span>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100">
          <p className="text-xs text-slate-400">Showing {(page - 1) * PAGE + 1}–{Math.min(page * PAGE, sorted.length)} of {sorted.length}</p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition-colors">
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
              return (
                <button key={p} onClick={() => setPage(p)}
                  className="w-8 h-8 rounded-lg text-xs font-medium transition-colors"
                  style={page === p ? { background: "#2563eb", color: "#ffffff" } : { color: "#64748b" }}>
                  {p}
                </button>
              );
            })}
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition-colors">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

export default InvoiceTable;
