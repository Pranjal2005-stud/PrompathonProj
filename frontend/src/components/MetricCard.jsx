import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FileText, ShieldX, DollarSign, Building2, Activity, Brain } from "lucide-react";

const CFG = {
  invoices: { icon: FileText,   color: "#2563eb", bg: "#eff6ff"  },
  blocked:  { icon: ShieldX,    color: "#dc2626", bg: "#fef2f2"  },
  leakage:  { icon: DollarSign, color: "#059669", bg: "#f0fdf4"  },
  vendors:  { icon: Building2,  color: "#d97706", bg: "#fffbeb"  },
  risk:     { icon: Activity,   color: "#7c3aed", bg: "#f5f3ff"  },
  ai:       { icon: Brain,      color: "#0891b2", bg: "#ecfeff"  },
};

function useCountUp(target, duration = 800) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const num = parseFloat(String(target).replace(/[^0-9.]/g, ""));
    if (isNaN(num)) { setVal(target); return; }
    let start = 0;
    const inc = num / (duration / 16);
    const t = setInterval(() => {
      start += inc;
      if (start >= num) { setVal(target); clearInterval(t); }
      else setVal(String(target).includes(".") ? start.toFixed(1) : Math.floor(start));
    }, 16);
    return () => clearInterval(t);
  }, [target]);
  return val;
}

export default function MetricCard({ type, title, value, sub, loading }) {
  const { icon: Icon, color, bg } = CFG[type] || CFG.invoices;
  const displayed = useCountUp(value);

  if (loading) return <div className="skeleton h-28 rounded-xl" />;

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
      className="rounded-xl p-5 cursor-default"
      style={{
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        transition: "box-shadow 0.2s",
      }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.08)"}
      onMouseLeave={e => e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)"}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-slate-500">{title}</p>
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: bg }}
        >
          <Icon size={14} style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-semibold text-slate-900 leading-none">{displayed}</p>
      {sub && <p className="text-xs text-slate-400 mt-1.5">{sub}</p>}
    </motion.div>
  );
}
