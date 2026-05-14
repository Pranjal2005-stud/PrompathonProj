"use client";
import { motion } from "framer-motion";
import { useState } from "react";
import { User, AlertTriangle, ArrowRight, Check } from "lucide-react";

interface ApprovalNode {
  id: string;
  label: string;
  role: string;
  isAnomaly?: boolean;
  anomalyReason?: string;
  isPending?: boolean;
  timestamp?: string;
}

interface ApprovalChainProps {
  invoiceId?: string | number;
  amount?: number;
}

export default function ApprovalChain({ invoiceId, amount }: ApprovalChainProps) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // Simulate approval chain with behavioral anomaly detection
  // In real implementation, this would come from invoice data
  const chain: ApprovalNode[] = [
    { id: "vendor", label: "Vendor", role: "Acme Corp", isPending: false, timestamp: "Day 0" },
    { id: "l1", label: "L1 Approver", role: "Dept Manager", isPending: false, timestamp: "Day 1" },
    { id: "l2", label: "L2 Approver", role: "Finance Lead", isPending: false, timestamp: "Day 2" },
    { id: "cfo", label: "CFO", role: "Final Approval", isAnomaly: true, anomalyReason: "Approval skipped L2 — behavioral pattern detected", timestamp: "Day 2" },
  ];

  const getNodeStyle = (node: ApprovalNode) => {
    if (node.isAnomaly) {
      return {
        bg: "#fef2f2",
        border: "#dc2626",
        iconColor: "#dc2626",
        pulse: true,
      };
    }
    if (node.isPending) {
      return {
        bg: "#fffbeb",
        border: "#d97706",
        iconColor: "#d97706",
        pulse: false,
      };
    }
    return {
      bg: "#f0fdf4",
      border: "#22c55e",
      iconColor: "#22c55e",
      pulse: false,
    };
  };

  return (
    <div className="rounded-2xl p-5" style={{ background: "linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%)", border: "1px solid #e2e8f0" }}>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "#eff6ff" }}>
          <User size={12} className="text-blue-600" />
        </div>
        <p className="text-sm font-semibold text-slate-700">Approval Chain Flow</p>
        <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>
          Behavioral Analysis
        </span>
      </div>

      {/* Chain Visualization */}
      <div className="flex items-center justify-between gap-2">
        {chain.map((node, index) => {
          const style = getNodeStyle(node);
          const isHovered = hoveredNode === node.id;

          return (
            <div key={node.id} className="flex items-center gap-2 flex-1">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: index * 0.1 }}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                className="relative flex flex-col items-center cursor-pointer"
              >
                {/* Node Circle */}
                <motion.div
                  animate={style.pulse ? {
                    boxShadow: [
                      "0 0 0 0 rgba(220, 38, 38, 0.4)",
                      "0 0 0 8px rgba(220, 38, 38, 0)",
                    ],
                  } : {}}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-12 h-12 rounded-full flex items-center justify-center relative"
                  style={{
                    background: style.bg,
                    border: `2px solid ${style.border}`,
                  }}
                >
                  {node.isAnomaly ? (
                    <AlertTriangle size={18} style={{ color: style.iconColor }} />
                  ) : node.isPending ? (
                    <User size={18} style={{ color: style.iconColor }} className="animate-pulse" />
                  ) : (
                    <Check size={18} style={{ color: style.iconColor }} />
                  )}
                </motion.div>

                {/* Label */}
                <div className="mt-2 text-center">
                  <p className="text-xs font-semibold text-slate-700">{node.label}</p>
                  <p className="text-[10px] text-slate-400">{node.role}</p>
                </div>

                {/* Timestamp */}
                <p className="text-[9px] text-slate-400 mt-0.5">{node.timestamp}</p>

                {/* Anomaly Tooltip */}
                {isHovered && node.isAnomaly && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute -bottom-16 left-1/2 -translate-x-1/2 w-48 p-2 rounded-lg z-20"
                    style={{ background: "#dc2626", color: "white" }}
                  >
                    <p className="text-[10px] font-medium leading-tight">{node.anomalyReason}</p>
                    <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45" style={{ background: "#dc2626" }} />
                  </motion.div>
                )}
              </motion.div>

              {/* Arrow connector */}
              {index < chain.length - 1 && (
                <div className="flex-1 flex items-center justify-center">
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: 0.3 + index * 0.1 }}
                    className="w-full h-0.5 rounded-full"
                    style={{ background: index < chain.length - 2 ? "#22c55e" : "#e2e8f0" }}
                  >
                    <ArrowRight size={12} className="text-slate-400 -mt-1.5" style={{ position: "relative", left: "50%", transform: "translateX(-50%)" }} />
                  </motion.div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Risk Summary */}
      <div className="mt-6 pt-4" style={{ borderTop: "1px solid #e2e8f0" }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">Approval Pattern</p>
            <p className="text-sm font-semibold text-slate-700 mt-0.5">Anomaly Detected</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Behavioral Score</p>
            <p className="text-sm font-bold font-mono" style={{ color: "#dc2626" }}>78.5 / 100</p>
          </div>
        </div>
      </div>
    </div>
  );
}