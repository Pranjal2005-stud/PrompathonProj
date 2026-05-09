import { useState } from "react";
import { motion } from "framer-motion";
import { Building2 } from "lucide-react";

function riskStyle(avg) {
  if (avg > 75) return { bg: "#fef2f2", border: "#fecaca", color: "#dc2626", dot: "#dc2626", label: "High"   };
  if (avg > 45) return { bg: "#fffbeb", border: "#fde68a", color: "#d97706", dot: "#d97706", label: "Medium" };
  return              { bg: "#f0fdf4", border: "#bbf7d0", color: "#059669", dot: "#059669", label: "Low"    };
}

export default function VendorHeatmap({ data = [], loading }) {
  const [hovered, setHovered] = useState(null);

  const map = {};
  data.forEach(d => {
    if (!d.vendor_name) return;
    if (!map[d.vendor_name]) map[d.vendor_name] = { scores: [], count: 0, blocked: 0 };
    map[d.vendor_name].scores.push(d.risk_score || 0);
    map[d.vendor_name].count++;
    if (d.decision === "BLOCK") map[d.vendor_name].blocked++;
  });

  const vendors = Object.entries(map)
    .map(([name, { scores, count, blocked }]) => ({
      name, count, blocked,
      avg: scores.reduce((a, b) => a + b, 0) / scores.length,
    }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 12);

  return (
    <div
      className="rounded-xl p-5 h-full"
      style={{
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-sm font-semibold text-slate-700">Vendor Risk Heatmap</p>
          <p className="text-xs text-slate-400 mt-0.5">Average risk score per vendor</p>
        </div>
        <div className="flex items-center gap-4">
          {[["#059669", "Low"], ["#d97706", "Medium"], ["#dc2626", "High"]].map(([c, l]) => (
            <span key={l} className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c }} />
              {l}
            </span>
          ))}
        </div>
      </div>

      {loading && (
        <div className="grid grid-cols-4 gap-3">
          {Array(8).fill(0).map((_, i) => <div key={i} className="skeleton h-20 rounded-lg" />)}
        </div>
      )}

      {!loading && vendors.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Building2 size={24} className="text-slate-300 mb-2" />
          <p className="text-sm text-slate-400">Upload invoices to see vendor risk</p>
        </div>
      )}

      <div className="grid grid-cols-4 gap-3">
        {vendors.map(({ name, avg, count, blocked }, i) => {
          const s = riskStyle(avg);
          return (
            <motion.div
              key={name}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.03 }}
              whileHover={{ y: -2 }}
              onMouseEnter={() => setHovered(name)}
              onMouseLeave={() => setHovered(null)}
              className="relative rounded-lg p-3.5 cursor-pointer transition-shadow"
              style={{
                background: s.bg,
                border: `1px solid ${s.border}`,
              }}
            >
              <p className="text-xs font-medium text-slate-600 truncate mb-2">{name}</p>
              <p className="text-xl font-semibold leading-none" style={{ color: s.color }}>
                {avg.toFixed(0)}
              </p>
              <div className="flex items-center gap-1.5 mt-2">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.dot }} />
                <span className="text-[10px] font-medium" style={{ color: s.color }}>{s.label}</span>
              </div>

              {hovered === name && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute -top-12 left-1/2 -translate-x-1/2 z-20 rounded-lg px-3 py-2 text-xs whitespace-nowrap pointer-events-none"
                  style={{
                    background: "#1e293b",
                    color: "#f8fafc",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                  }}
                >
                  {count} invoices · {blocked} blocked · Avg {avg.toFixed(1)}
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
