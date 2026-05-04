import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, AlertTriangle, XCircle } from "lucide-react";

const config = {
  success: { icon: CheckCircle, color: "#10b981", bg: "rgba(16,185,129,0.1)",  border: "rgba(16,185,129,0.25)" },
  warning: { icon: AlertTriangle, color: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.25)" },
  error:   { icon: XCircle,     color: "#ef4444", bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.25)" },
};

export default function ToastContainer({ toasts }) {
  return (
    <div className="fixed top-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map(({ id, message, type }) => {
          const { icon: Icon, color, bg, border } = config[type] || config.error;
          return (
            <motion.div key={id} initial={{ opacity: 0, x: 60, scale: 0.9 }} animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 60, scale: 0.9 }} transition={{ type: "spring", damping: 20, stiffness: 300 }}
              className="flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-2xl pointer-events-auto max-w-xs"
              style={{ background: "rgba(255,255,255,0.97)", backdropFilter: "blur(20px)", borderColor: border, boxShadow: `0 8px 32px rgba(0,0,0,0.12), 0 0 0 1px ${border}` }}>
              <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0" style={{ background: bg }}>
                <Icon size={14} style={{ color }} />
              </div>
              <p className="text-xs font-medium text-slate-700">{message}</p>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
