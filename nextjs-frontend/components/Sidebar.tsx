"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Bell, ClipboardList, Search,
  FileSearch, FileDown, Settings, ShieldCheck,
  ChevronLeft, ChevronRight, ChevronDown,
} from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { useAppStore } from "@/store";
import type { PageId, Invoice } from "@/types";

const SECTIONS = [
  {
    label: "Overview",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", id: "dashboard" as PageId },
    ],
  },
  {
    label: "Investigation",
    items: [
      { icon: Bell,           label: "Alerts",   id: "alerts"    as PageId, badge: true },
      { icon: ClipboardList,   label: "Queue",     id: "queue"    as PageId },
      { icon: Search,          label: "Search",   id: "forensic"  as PageId },
    ],
  },
  {
    label: "Data",
    items: [
      { icon: FileSearch, label: "Invoices",  id: "invoices"  as PageId },
    ],
  },
];

function generatePDF(data: Invoice[]) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const now = new Date().toLocaleString();
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, 210, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("ENTERPRISE FRAUD INVESTIGATION REPORT", 14, 12);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated: ${now}  |  CONFIDENTIAL`, 14, 20);
  const blocked = data.filter((d) => d.decision === "BLOCK").length;
  const review  = data.filter((d) => d.decision === "REVIEW").length;
  const leakage = data.filter((d) => d.decision === "BLOCK").reduce((s, d) => s + (d.invoice_amount ?? 0), 0);
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("EXECUTIVE SUMMARY", 14, 38);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text(`Fraud Detected: ${blocked} (${data.length ? ((blocked / data.length) * 100).toFixed(1) : 0}%)`, 14, 46);
  doc.text(`Under Review: ${review}`, 14, 52);
  doc.text(`Estimated Loss Prevented: ₹${leakage.toLocaleString()}`, 14, 58);
  autoTable(doc, {
    startY: 70,
    head: [["Invoice ID", "Vendor", "Amount (₹)", "Risk Score", "Decision", "Fraud Flags"]],
    body: data
      .filter((d) => d.decision !== "APPROVE")
      .sort((a, b) => (b.risk_score ?? 0) - (a.risk_score ?? 0))
      .slice(0, 50)
      .map((d) => [
        String(d.invoice_id ?? "—"), d.vendor_name ?? "—",
        (d.invoice_amount ?? 0).toLocaleString(),
        (d.risk_score ?? 0).toFixed(1), d.decision ?? "—",
        (d.reason ?? "Normal").substring(0, 60),
      ]),
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 7.5, textColor: [15, 23, 42] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
  });
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`Page ${i} of ${pageCount}  |  Invoice Fraud Detection System  |  CONFIDENTIAL`, 14, 290);
  }
  doc.save(`fraud-report-${Date.now()}.pdf`);
}

export default function Sidebar() {
  const { activePage, setActivePage, invoices } = useAppStore();
  const alertCount = invoices.filter((d) => d.decision === "BLOCK").length;

  const [collapsed, setCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    Monitoring: true, Investigation: true, Analytics: true,
  });

  const toggle = (label: string) => {
    if (collapsed) return;
    setOpenSections((s) => ({ ...s, [label]: !s[label] }));
  };

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ duration: 0.22, ease: "easeInOut" }}
      className="shrink-0 flex flex-col h-screen sticky top-0 overflow-hidden z-20 bg-white"
      style={{ borderRight: "1px solid #e2e8f0" }}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 shrink-0" style={{ borderBottom: "1px solid #e2e8f0" }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-blue-600">
          <ShieldCheck size={15} className="text-white" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }} className="ml-3 min-w-0"
            >
              <p className="text-sm font-semibold text-slate-800 leading-tight">
                Invoice Fraud Detection System
              </p>
            </motion.div>
          )}
        </AnimatePresence>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="ml-auto shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-2 space-y-1">
        {SECTIONS.map(({ label, items }) => (
          <div key={label} className="mb-1">
            <button
              onClick={() => toggle(label)}
              className="w-full flex items-center px-3 py-1.5 mb-0.5 rounded-md"
            >
              <AnimatePresence>
                {!collapsed && (
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex items-center justify-between w-full"
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</span>
                    <ChevronDown
                      size={10}
                      className="text-slate-400"
                      style={{ transform: openSections[label] ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.2s" }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </button>

            <AnimatePresence initial={false}>
              {(collapsed || openSections[label]) && (
                <motion.div
                  initial={collapsed ? false : { height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="overflow-hidden space-y-0.5"
                >
                  {items.map(({ icon: Icon, label: itemLabel, id, badge }) => {
                    const isActive = activePage === id;
                    return (
                      <button
                        key={id}
                        onClick={() => setActivePage(id)}
                        title={collapsed ? itemLabel : undefined}
                        className="w-full flex items-center rounded-lg transition-all duration-150 relative"
                        style={{
                          padding: collapsed ? "9px 10px" : "8px 12px",
                          background: isActive ? "rgba(37,99,235,0.08)" : "transparent",
                        }}
                        onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "#f8fafc"; }}
                        onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                      >
                        {isActive && (
                          <motion.span
                            layoutId="sidebarActive"
                            className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-r-full"
                            style={{ background: "linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%)" }}
                          />
                        )}
                        <Icon size={14} className="shrink-0" style={{ color: isActive ? "#2563eb" : "#94a3b8" }} />
                        <AnimatePresence>
                          {!collapsed && (
                            <motion.span
                              initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }}
                              transition={{ duration: 0.13 }}
                              className="ml-2.5 text-[13px] whitespace-nowrap flex-1 text-left"
                              style={{ fontWeight: isActive ? 500 : 400, color: isActive ? "#2563eb" : "#64748b" }}
                            >
                              {itemLabel}
                            </motion.span>
                          )}
                        </AnimatePresence>
                        {badge && alertCount > 0 && !collapsed && (
                          <span className="ml-auto text-[9px] font-bold text-white px-1.5 py-0.5 rounded-full bg-red-500 min-w-[18px] text-center">
                            {alertCount > 9 ? "9+" : alertCount}
                          </span>
                        )}
                        {badge && alertCount > 0 && collapsed && (
                          <span className="absolute top-1 right-1 w-2 h-2 rounded-full animate-pulse bg-red-500" />
                        )}
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}

        {/* Reports */}
        <div className="pt-2" style={{ borderTop: "1px solid #e2e8f0" }}>
          <AnimatePresence>
            {!collapsed && (
              <motion.p
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400"
              />
            )}
          </AnimatePresence>
          <button
            onClick={() => invoices.length > 0 && generatePDF(invoices)}
            title={collapsed ? "Export PDF" : undefined}
            disabled={invoices.length === 0}
            className="w-full flex items-center rounded-lg transition-all disabled:opacity-30"
            style={{ padding: collapsed ? "9px 10px" : "8px 12px" }}
            onMouseEnter={(e) => { if (invoices.length > 0) e.currentTarget.style.background = "#f0fdf4"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <FileDown size={15} className="shrink-0 text-emerald-500" />
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }}
                  className="ml-3 text-[13px] whitespace-nowrap text-emerald-600"
                >
                  Export PDF Report
                </motion.span>
              )}
            </AnimatePresence>
          </button>
          <button
            onClick={() => setActivePage("settings")}
            title={collapsed ? "Settings" : undefined}
            className="w-full flex items-center rounded-lg transition-all"
            style={{ padding: collapsed ? "9px 10px" : "8px 12px" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#f8fafc"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <Settings size={15} className="shrink-0 text-slate-400" />
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }}
                  className="ml-3 text-[13px] whitespace-nowrap text-slate-500"
                >
                  Settings
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </nav>
    </motion.aside>
  );
}
