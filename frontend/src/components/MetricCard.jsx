import { useEffect, useState } from "react";
import { FileText, ShieldX, Eye, CheckCircle, Activity, DollarSign } from "lucide-react";
import { motion } from "framer-motion";

const config = {
  file:    { icon: FileText,     bg: "rgba(99,102,241,0.1)",  color: "#6366f1", glow: "rgba(99,102,241,0.2)" },
  block:   { icon: ShieldX,      bg: "rgba(239,68,68,0.1)",   color: "#ef4444", glow: "rgba(239,68,68,0.2)" },
  review:  { icon: Eye,          bg: "rgba(245,158,11,0.1)",  color: "#f59e0b", glow: "rgba(245,158,11,0.2)" },
  approve: { icon: CheckCircle,  bg: "rgba(16,185,129,0.1)",  color: "#10b981", glow: "rgba(16,185,129,0.2)" },
  risk:    { icon: Activity,     bg: "rgba(139,92,246,0.1)",  color: "#8b5cf6", glow: "rgba(139,92,246,0.2)" },
  amount:  { icon: DollarSign,   bg: "rgba(14,165,233,0.1)",  color: "#0ea5e9", glow: "rgba(14,165,233,0.2)" },
};

function useCountUp(target, duration = 1000) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const num = parseFloat(target);
    if (isNaN(num)) { setVal(target); return; }
    let start = 0;
    const step = num / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= num) { setVal(target); clearInterval(timer); }
      else setVal(typeof target === "string" && target.includes(".") ? start.toFixed(1) : Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [target]);
  return val;
}

export default function MetricCard({ title, value, icon, sub, loading }) {
  const { icon: Icon, bg, color, glow } = config[icon] || config.file;
  const displayed = useCountUp(value);

  if (loading) {
    return (
      <div className="rounded-2xl p-4 border animate-pulse" style={{ background: "rgba(255,255,255,0.6)", borderColor: "rgba(255,255,255,0.5)" }}>
        <div className="w-8 h-8 rounded-xl bg-slate-200 mb-3" />
        <div className="h-3 w-16 bg-slate-200 rounded mb-2" />
        <div className="h-6 w-10 bg-slate-200 rounded" />
      </div>
    );
  }

  return (
    <motion.div whileHover={{ y: -3, boxShadow: `0 12px 30px ${glow}` }} transition={{ duration: 0.2 }}
      className="rounded-2xl p-4 border cursor-default"
      style={{ background: "rgba(255,255,255,0.25)", backdropFilter: "blur(24px)", borderColor: "rgba(255,255,255,0.5)", boxShadow: "0 4px 24px rgba(99,102,241,0.08)" }}>
      <div className="flex items-center justify-between mb-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: bg }}>
          <Icon size={16} style={{ color }} />
        </div>
      </div>
      <p className="text-xs font-medium text-slate-600 mb-0.5">{title}</p>
      <p className="text-2xl font-bold text-slate-900">{displayed}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </motion.div>
  );
}
