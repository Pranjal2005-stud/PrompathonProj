import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Zap, FileSearch, Building2,
  Bot, Settings, ShieldCheck, ChevronLeft, ChevronRight,
} from "lucide-react";

const SECTIONS = [
  {
    label: "Overview",
    items: [
      { icon: LayoutDashboard, label: "Dashboard",          id: "dashboard" },
      { icon: Zap,             label: "Live Alerts",         id: "alerts",   badge: true },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { icon: FileSearch, label: "Invoice Analysis",    id: "invoices" },
      { icon: Building2,  label: "Vendor Intelligence", id: "vendors"  },
      { icon: Bot,        label: "AI Copilot",          id: "copilot"  },
    ],
  },
  {
    label: "System",
    items: [
      { icon: Settings, label: "Settings", id: "settings" },
    ],
  },
];

export default function Sidebar({ active, onNav, alertCount = 0 }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <motion.aside
      animate={{ width: collapsed ? 68 : 256 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      className="shrink-0 flex flex-col h-screen sticky top-0 overflow-hidden"
      style={{
        background: "var(--sidebar-bg)",
        borderRight: "1px solid var(--sidebar-border)",
        zIndex: 20,
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center h-16 px-4 border-b shrink-0"
        style={{ borderColor: "var(--sidebar-border)" }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "#2563eb" }}
        >
          <ShieldCheck size={16} className="text-white" />
        </div>

        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.18 }}
              className="ml-3 min-w-0 overflow-hidden"
            >
              <p className="text-sm font-semibold text-slate-800 whitespace-nowrap">Fraud Intelligence</p>
              <p className="text-[10px] text-slate-400 whitespace-nowrap mt-0.5">AI Platform · FY 2024–25</p>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => setCollapsed(c => !c)}
          className="ml-auto shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-2 space-y-5">
        {SECTIONS.map(({ label, items }) => (
          <div key={label}>
            <AnimatePresence>
              {!collapsed && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="px-3 mb-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-widest whitespace-nowrap"
                >
                  {label}
                </motion.p>
              )}
            </AnimatePresence>

            <div className="space-y-0.5">
              {items.map(({ icon: Icon, label: itemLabel, id, badge }) => {
                const isActive = active === id;
                return (
                  <button
                    key={id}
                    onClick={() => onNav(id)}
                    title={collapsed ? itemLabel : undefined}
                    className="w-full flex items-center rounded-lg transition-all duration-150 group relative"
                    style={{
                      padding: collapsed ? "9px 10px" : "9px 12px",
                      background: isActive ? "#eff6ff" : "transparent",
                      color: isActive ? "#2563eb" : "#64748b",
                    }}
                  >
                    {/* Active indicator */}
                    {isActive && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                        style={{ background: "#2563eb" }}
                      />
                    )}

                    <Icon
                      size={17}
                      className="shrink-0 transition-colors"
                      style={{ color: isActive ? "#2563eb" : "#64748b" }}
                    />

                    <AnimatePresence>
                      {!collapsed && (
                        <motion.span
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -6 }}
                          transition={{ duration: 0.15 }}
                          className="ml-3 text-sm whitespace-nowrap overflow-hidden flex-1 text-left"
                          style={{ fontWeight: isActive ? 600 : 400 }}
                        >
                          {itemLabel}
                        </motion.span>
                      )}
                    </AnimatePresence>

                    {badge && alertCount > 0 && !collapsed && (
                      <span
                        className="ml-auto text-[10px] font-semibold text-white px-1.5 py-0.5 rounded-full shrink-0"
                        style={{ background: "#dc2626" }}
                      >
                        {alertCount > 9 ? "9+" : alertCount}
                      </span>
                    )}

                    {badge && alertCount > 0 && collapsed && (
                      <span
                        className="absolute top-1 right-1 w-2 h-2 rounded-full"
                        style={{ background: "#dc2626" }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* AI Status */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="px-3 pb-4 shrink-0"
          >
            <div
              className="rounded-xl p-3.5"
              style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <p className="text-xs font-medium text-slate-600">AI Engine Active</p>
              </div>
              <div className="h-1 rounded-full overflow-hidden bg-slate-100">
                <motion.div
                  className="h-full rounded-full bg-blue-500"
                  initial={{ width: "0%" }}
                  animate={{ width: "78%" }}
                  transition={{ duration: 1.2, delay: 0.3 }}
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5">IsolationForest · 78% confidence</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  );
}
