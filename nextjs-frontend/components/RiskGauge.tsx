"use client";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Shield, AlertTriangle, CheckCircle, AlertOctagon } from "lucide-react";

interface RiskGaugeProps {
  score?: number;
  label?: string;
}

export default function RiskGauge({ score = 0, label = "System Threat Level" }: RiskGaugeProps) {
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedScore(score), 100);
    return () => clearTimeout(timer);
  }, [score]);

  const getThreatLevel = (value: number) => {
    if (value >= 70) return { label: "CRITICAL", color: "#dc2626", bg: "#fef2f2" };
    if (value >= 50) return { label: "HIGH", color: "#d97706", bg: "#fffbeb" };
    if (value >= 30) return { label: "MEDIUM", color: "#ea580c", bg: "#fff7ed" };
    return { label: "LOW", color: "#22c55e", bg: "#f0fdf4" };
  };

  const threat = getThreatLevel(animatedScore);
  const percentage = Math.min(100, animatedScore);
  const circumference = 2 * Math.PI * 54;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const getIcon = () => {
    if (animatedScore >= 70) return <AlertOctagon size={24} />;
    if (animatedScore >= 50) return <AlertTriangle size={24} />;
    return <Shield size={24} />;
  };

  return (
    <div className="rounded-2xl p-6 bg-white" style={{ border: "1px solid #e2e8f0" }}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-slate-700">{label}</p>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: threat.bg }}>
          <span className="text-[10px] font-bold" style={{ color: threat.color }}>{threat.label}</span>
        </div>
      </div>

      <div className="flex items-center justify-center">
        <div className="relative w-32 h-32">
          {/* Background circle */}
          <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke="#f1f5f9"
              strokeWidth="10"
            />
            {/* Animated score circle */}
            <motion.circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke={threat.color}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </svg>

          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.5 }}
              style={{ color: threat.color }}
            >
              {getIcon()}
            </motion.div>
            <motion.span
              className="text-2xl font-bold font-mono mt-1"
              style={{ color: threat.color }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              {animatedScore}
            </motion.span>
            <span className="text-[10px] text-slate-400">/ 100</span>
          </div>
        </div>
      </div>

      {/* Risk breakdown */}
      <div className="grid grid-cols-3 gap-2 mt-4 pt-4" style={{ borderTop: "1px solid #f1f5f9" }}>
        <div className="text-center">
          <p className="text-[10px] text-slate-400">ML Model</p>
          <p className="text-sm font-bold font-mono text-slate-700">{Math.round(animatedScore * 0.4)}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-slate-400">Rules</p>
          <p className="text-sm font-bold font-mono text-slate-700">{Math.round(animatedScore * 0.35)}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-slate-400">Behavioral</p>
          <p className="text-sm font-bold font-mono text-slate-700">{Math.round(animatedScore * 0.25)}</p>
        </div>
      </div>
    </div>
  );
}