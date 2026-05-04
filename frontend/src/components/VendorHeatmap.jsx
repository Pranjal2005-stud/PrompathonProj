import { motion } from "framer-motion";
import { Building2 } from "lucide-react";
import { useState } from "react";

const CARD = { background: "rgba(255,255,255,0.25)", backdropFilter: "blur(24px)", borderColor: "rgba(255,255,255,0.5)", boxShadow: "0 4px 24px rgba(99,102,241,0.08)" };

function getRiskColor(avg) {
  if (avg > 75) return { bg: "rgba(239,68,68,0.15)", border: "rgba(239,68,68,0.3)", text: "#ef4444", label: "High" };
  if (avg > 45) return { bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)", text: "#f59e0b", label: "Med" };
  return { bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.25)", text: "#10b981", label: "Low" };
}

export default function VendorHeatmap({ data = [], loading }) {
  const [hovered, setHovered] = useState(null);

  const vendorMap = {};
  data.forEach((d) => {
    if (!d.vendor_name) return;
    if (!vendorMap[d.vendor_name]) vendorMap[d.vendor_name] = { scores: [], count: 0 };
    vendorMap[d.vendor_name].scores.push(d.risk_score || 0);
    vendorMap[d.vendor_name].count++;
  });

  const vendors = Object.entries(vendorMap)
    .map(([name, { scores, count }]) => ({
      name,
      avg: scores.reduce((a, b) => a + b, 0) / scores.length,
      count,
    }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 12);

  return (
    <div className="rounded-2xl p-5 border" style={CARD}>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(245,158,11,0.1)" }}>
          <Building2 size={14} style={{ color: "#f59e0b" }} />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">Vendor Risk Heatmap</p>
          <p className="text-xs text-slate-600">Color intensity = risk level</p>
        </div>
        <div className="ml-auto flex items-center gap-3 text-xs text-slate-600">
          {[["#10b981", "Low"], ["#f59e0b", "Med"], ["#ef4444", "High"]].map(([c, l]) => (
            <span key={l} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ background: c }} />{l}
            </span>
          ))}
        </div>
      </div>

      {loading && (
        <div className="grid grid-cols-4 gap-2">
          {Array(8).fill(0).map((_, i) => <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />)}
        </div>
      )}

      {!loading && vendors.length === 0 && (
        <p className="text-xs text-slate-600 text-center py-8">Upload a CSV to see vendor risk heatmap</p>
      )}

      <div className="grid grid-cols-4 gap-2">
        {vendors.map(({ name, avg, count }, i) => {
          const { bg, border, text, label } = getRiskColor(avg);
          const isHov = hovered === name;
          return (
            <motion.div key={name} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.04 }} whileHover={{ scale: 1.04 }}
              onMouseEnter={() => setHovered(name)} onMouseLeave={() => setHovered(null)}
              className="relative rounded-xl p-3 border cursor-pointer transition-all"
              style={{ background: bg, borderColor: border }}>
              <p className="text-xs font-semibold text-slate-800 truncate">{name}</p>
              <p className="text-lg font-bold mt-1" style={{ color: text }}>{avg.toFixed(0)}</p>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: border, color: text }}>{label}</span>

              {isHov && (
                <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  className="absolute -top-12 left-1/2 -translate-x-1/2 z-10 rounded-xl px-3 py-2 text-xs whitespace-nowrap shadow-xl border"
                  style={{ background: "rgba(255,255,255,0.98)", borderColor: "rgba(99,102,241,0.2)" }}>
                  <p className="font-semibold text-slate-700">{name}</p>
                  <p className="text-slate-400">{count} invoice{count !== 1 ? "s" : ""} · Avg risk: {avg.toFixed(1)}</p>
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
