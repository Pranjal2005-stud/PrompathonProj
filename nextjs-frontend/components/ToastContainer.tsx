"use client";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, AlertTriangle, XCircle, Info } from "lucide-react";
import { useAppStore } from "@/store";

const CFG = {
  success: { icon: CheckCircle,   color: "#059669", bg: "#f0fdf4", border: "#bbf7d0" },
  warning: { icon: AlertTriangle, color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  error:   { icon: XCircle,       color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
  info:    { icon: Info,          color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
} as const;

export default function ToastContainer() {
  const toasts = useAppStore((s) => s.toasts);

  return (
    <div className="fixed bottom-24 right-6 z-[200] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map(({ id, message, type }) => {
          const { icon: Icon, color, bg, border } = CFG[type] ?? CFG.info;
          return (
            <motion.div
              key={id}
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={{ type: "spring", damping: 22, stiffness: 300 }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl pointer-events-auto bg-white"
              style={{ border: `1px solid ${border}`, boxShadow: "0 4px 16px rgba(0,0,0,0.08)", maxWidth: "320px" }}
            >
              <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: bg }}>
                <Icon size={13} style={{ color }} />
              </div>
              <p className="text-sm text-slate-700">{message}</p>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
