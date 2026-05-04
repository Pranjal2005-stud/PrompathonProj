import { useState } from "react";
import { LayoutDashboard, FileText, AlertTriangle, Building2, BarChart2, FileOutput, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

const items = [
  { icon: LayoutDashboard, label: "Dashboard" },
  { icon: FileText, label: "Invoices" },
  { icon: AlertTriangle, label: "Alerts" },
  { icon: Building2, label: "Vendors" },
  { icon: BarChart2, label: "Analytics" },
  { icon: FileOutput, label: "Reports" },
];

export default function Sidebar() {
  const [active, setActive] = useState("Dashboard");

  return (
    <aside className="w-56 shrink-0 flex flex-col py-6 px-3 border-r"
      style={{ background: "rgba(255,255,255,0.25)", backdropFilter: "blur(24px)", borderColor: "rgba(255,255,255,0.4)", boxShadow: "1px 0 0 rgba(255,255,255,0.5)" }}>

      {/* Logo */}
      <div className="flex items-center gap-2.5 px-3 mb-8">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow-lg"
          style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
          <ShieldCheck size={16} className="text-white" />
        </div>
        <div>
          <p className="font-bold text-slate-800 text-sm leading-none">FraudAI</p>
          <p className="text-xs text-slate-400 mt-0.5">Intelligence</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 flex-1">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest px-3 mb-2">Menu</p>
        {items.map(({ icon: Icon, label }) => {
          const isActive = active === label;
          return (
            <motion.button key={label} whileHover={{ x: 2 }} whileTap={{ scale: 0.97 }}
              onClick={() => setActive(label)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium w-full text-left transition-all
                ${isActive ? "text-white shadow-lg" : "text-slate-700 hover:text-slate-900 hover:bg-white/50"}`}
              style={isActive ? { background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 4px 15px rgba(99,102,241,0.35)" } : {}}>
              <Icon size={16} />
              {label}
              {label === "Alerts" && (
                <span className="ml-auto w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              )}
            </motion.button>
          );
        })}
      </nav>

      {/* AI Badge */}
      <div className="mx-1 mt-4 rounded-2xl p-3 border"
        style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.08))", borderColor: "rgba(99,102,241,0.2)" }}>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <p className="text-xs font-semibold text-indigo-700">AI Model Active</p>
        </div>
        <p className="text-xs text-indigo-400">IsolationForest v2.1</p>
        <div className="mt-2 h-1 rounded-full bg-indigo-100 overflow-hidden">
          <div className="h-full rounded-full w-3/4" style={{ background: "linear-gradient(90deg, #6366f1, #8b5cf6)" }} />
        </div>
      </div>
    </aside>
  );
}
