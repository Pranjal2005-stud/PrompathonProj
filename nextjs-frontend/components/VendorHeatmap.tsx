"use client";
import { useMemo, memo } from "react";
import ReactECharts from "echarts-for-react";
import { motion } from "framer-motion";
import { Building2, ShieldX, TrendingUp, AlertTriangle } from "lucide-react";
import { useAppStore } from "@/store";
import { getFraudCategory } from "@/lib/utils";
import { Skeleton } from "@/components/ui/primitives";

const FRAUD_TYPES = ["Shell Vendor", "Anomaly"];

const VendorHeatmap = memo(function VendorHeatmap() {
  const { invoices: data, loading, setSelectedInvoice } = useAppStore();

  const { vendors, heatData, scatterData, topRisk } = useMemo(() => {
    const vendorMap: Record<string, {
      scores: number[];
      byType: Record<string, number[]>;
      invoices: typeof data;
      blocked: number;
      total: number;
    }> = {};

    data.forEach((d) => {
      if (!d.vendor_name) return;
      const cat = getFraudCategory(d);
      if (!vendorMap[d.vendor_name]) {
        vendorMap[d.vendor_name] = { scores: [], byType: {}, invoices: [], blocked: 0, total: 0 };
      }
      vendorMap[d.vendor_name].scores.push(d.risk_score ?? 0);
      vendorMap[d.vendor_name].invoices.push(d);
      vendorMap[d.vendor_name].total++;
      if (d.decision === "BLOCK") vendorMap[d.vendor_name].blocked++;
      if (cat) {
        if (!vendorMap[d.vendor_name].byType[cat]) vendorMap[d.vendor_name].byType[cat] = [];
        vendorMap[d.vendor_name].byType[cat].push(d.risk_score ?? 0);
      }
    });

    const sorted = Object.entries(vendorMap)
      .map(([name, v]) => ({
        name,
        avg: v.scores.reduce((a, b) => a + b, 0) / v.scores.length,
        byType: v.byType,
        invoices: v.invoices,
        blocked: v.blocked,
        total: v.total,
        blockRate: v.total > 0 ? (v.blocked / v.total) * 100 : 0,
      }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 12);

    const hd: [number, number, number | null][] = [];
    sorted.forEach((vendor, yi) => {
      FRAUD_TYPES.forEach((ft, xi) => {
        const scores = vendor.byType[ft];
        const val = scores?.length
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : null;
        hd.push([xi, yi, val]);
      });
    });

    // Scatter: x = total invoices, y = avg risk, size = blocked count
    const scatter = sorted.map((v) => ({
      name: v.name,
      value: [v.total, parseFloat(v.avg.toFixed(1)), v.blocked],
    }));

    const top = sorted.slice(0, 5);

    return { vendors: sorted, heatData: hd, scatterData: scatter, topRisk: top };
  }, [data]);

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <Skeleton className="rounded-2xl h-96" />
        <Skeleton className="rounded-2xl h-72" />
      </div>
    );
  }

  if (vendors.length === 0) {
    return (
      <div className="rounded-2xl p-16 flex flex-col items-center justify-center bg-white"
        style={{ border: "1px solid #e2e8f0", minHeight: "400px" }}>
        <Building2 size={40} className="text-slate-200 mb-4" />
        <p className="text-base font-medium text-slate-400 mb-1">No vendor data yet</p>
        <p className="text-sm text-slate-300">Upload invoices to see vendor risk intelligence</p>
      </div>
    );
  }

  const totalVendors = vendors.length;
  const highRiskVendors = vendors.filter(v => v.avg >= 65).length;
  const totalBlocked = vendors.reduce((s, v) => s + v.blocked, 0);
  const avgRisk = vendors.reduce((s, v) => s + v.avg, 0) / vendors.length;

  const tooltipStyle = {
    backgroundColor: "#0f172a",
    borderColor: "#1e293b",
    textStyle: { color: "#f8fafc", fontSize: 12 },
  };

  const heatOption = {
    tooltip: {
      ...tooltipStyle,
      position: "top",
      formatter: (params: { data: [number, number, number | null] }) => {
        const [xi, yi, val] = params.data;
        const vendor = vendors[yi]?.name ?? "";
        const ft = FRAUD_TYPES[xi] ?? "";
        const color = val !== null && val >= 65 ? "#f87171" : val !== null && val >= 35 ? "#fbbf24" : "#34d399";
        return `<div style="font-size:12px;padding:6px 10px;line-height:1.6">
          <strong style="color:#f8fafc">${vendor}</strong><br/>
          <span style="color:#94a3b8">${ft}</span><br/>
          Risk Score: <strong style="color:${color}">${val ?? "No data"}</strong>
        </div>`;
      },
    },
    grid: { top: 20, bottom: 30, left: 150, right: 80 },
    xAxis: {
      type: "category",
      data: FRAUD_TYPES,
      splitArea: { show: true, areaStyle: { color: ["rgba(248,250,252,0.6)", "rgba(241,245,249,0.6)"] } },
      axisLabel: { fontSize: 11, color: "#64748b", fontWeight: "500" },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: {
      type: "category",
      data: vendors.map((v) => v.name.length > 18 ? v.name.substring(0, 18) + "…" : v.name),
      splitArea: { show: true, areaStyle: { color: ["rgba(248,250,252,0.6)", "rgba(241,245,249,0.6)"] } },
      axisLabel: { fontSize: 11, color: "#475569", fontWeight: "500" },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    // visualMap hidden — we use custom legend in header to avoid collision
    visualMap: {
      show: false,
      min: 0,
      max: 100,
      inRange: {
        color: ["#dcfce7", "#bbf7d0", "#fef9c3", "#fde68a", "#fed7aa", "#fca5a5", "#f87171", "#ef4444"],
      },
    },
    series: [
      {
        type: "heatmap",
        data: heatData.filter(([, , v]) => v !== null),
        label: {
          show: true,
          fontSize: 12,
          fontWeight: "bold",
          // Always black — light pastel backgrounds guarantee readability
          color: "#1e293b",
        },
        emphasis: {
          itemStyle: { shadowBlur: 12, shadowColor: "rgba(0,0,0,0.15)", borderColor: "#fff", borderWidth: 2 },
        },
        itemStyle: { borderRadius: 5, borderWidth: 3, borderColor: "#ffffff" },
      },
    ],
  };

  const scatterOption = {
    tooltip: {
      ...tooltipStyle,
      formatter: (params: { data: { name: string; value: [number, number, number] } }) => {
        const [total, avg, blocked] = params.data.value;
        return `<div style="font-size:12px;padding:6px 10px;line-height:1.8">
          <strong style="color:#f8fafc">${params.data.name}</strong><br/>
          <span style="color:#94a3b8">Invoices:</span> <strong style="color:#60a5fa">${total}</strong><br/>
          <span style="color:#94a3b8">Avg Risk:</span> <strong style="color:${avg >= 65 ? "#f87171" : avg >= 35 ? "#fbbf24" : "#34d399"}">${avg}</strong><br/>
          <span style="color:#94a3b8">Blocked:</span> <strong style="color:#f87171">${blocked}</strong>
        </div>`;
      },
    },
    grid: { top: 20, right: 30, bottom: 40, left: 50 },
    xAxis: {
      type: "value",
      name: "Total Invoices",
      nameLocation: "middle",
      nameGap: 28,
      nameTextStyle: { color: "#94a3b8", fontSize: 11 },
      axisLabel: { fontSize: 10, color: "#94a3b8" },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: "#f1f5f9" } },
    },
    yAxis: {
      type: "value",
      name: "Avg Risk Score",
      nameLocation: "middle",
      nameGap: 36,
      nameTextStyle: { color: "#94a3b8", fontSize: 11 },
      min: 0,
      max: 100,
      axisLabel: { fontSize: 10, color: "#94a3b8" },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: "#f1f5f9" } },
    },
    series: [
      {
        type: "scatter",
        data: scatterData.map((d) => ({
          name: d.name,
          value: d.value,
          symbolSize: Math.max(12, Math.min(48, (d.value[2] as number) * 6 + 12)),
          itemStyle: {
            color: (d.value[1] as number) >= 65 ? "#ef4444"
              : (d.value[1] as number) >= 35 ? "#f97316"
              : "#22c55e",
            opacity: 0.85,
            borderColor: "#fff",
            borderWidth: 2,
          },
        })),
        label: {
          show: scatterData.length <= 10,
          position: "top",
          formatter: (p: { data: { name: string } }) => p.data.name.split(" ")[0],
          fontSize: 9,
          color: "#64748b",
        },
        emphasis: { scale: 1.2 },
      },
    ],
  };

  return (
    <div className="space-y-5">
      {/* KPI row */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-4 gap-4"
      >
        {[
          { label: "Total Vendors",    value: totalVendors,                  icon: Building2,    color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
          { label: "High Risk Vendors",  value: highRiskVendors,               icon: ShieldX,      color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
          { label: "Blocked Invoices",   value: totalBlocked,                  icon: AlertTriangle,color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
          { label: "Avg Risk Score",     value: parseFloat(avgRisk.toFixed(1)),icon: TrendingUp,   color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
        ].map(({ label, value, icon: Icon, color, bg, border }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className="rounded-2xl p-4 bg-white overflow-hidden"
            style={{ border: `1px solid ${border}`, boxShadow: "var(--card-shadow)" }}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: bg }}>
                <Icon size={16} style={{ color }} />
              </div>
              <p className="text-xs font-medium text-slate-500 leading-tight">{label}</p>
            </div>
            <p
              className="text-2xl font-bold leading-none tabular-nums truncate"
              style={{ color }}
            >
              {value}
            </p>
          </motion.div>
        ))}
      </motion.div>

      {/* Main heatmap */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="rounded-2xl p-6 bg-white"
        style={{ border: "1px solid #e2e8f0", boxShadow: "var(--card-shadow)" }}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-sm font-semibold text-slate-800">Vendor × Fraud Type Risk Matrix</p>
            <p className="text-xs text-slate-400 mt-0.5">Average risk score per vendor per fraud category — click a cell to inspect</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm" style={{ background: "#22c55e" }} />
              <span className="text-[10px] text-slate-400">Low (&lt;35)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm" style={{ background: "#f97316" }} />
              <span className="text-[10px] text-slate-400">Medium (35–65)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm" style={{ background: "#ef4444" }} />
              <span className="text-[10px] text-slate-400">High (&gt;65)</span>
            </div>
          </div>
        </div>
        <ReactECharts
          option={heatOption}
          style={{ height: `${Math.max(280, vendors.length * 48 + 80)}px` }}
          onEvents={{
            click: (params: { data: [number, number, number] }) => {
              const [xi, yi] = params.data;
              const vendor = vendors[yi];
              const ft = FRAUD_TYPES[xi];
              if (vendor) {
                const inv = vendor.invoices.find((d) => getFraudCategory(d) === ft) ?? vendor.invoices[0];
                if (inv) setSelectedInvoice(inv);
              }
            },
          }}
        />
      </motion.div>

      {/* Bottom row: scatter + top risk table */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="grid gap-5"
        style={{ gridTemplateColumns: "1fr 1fr" }}
      >
        {/* Scatter */}
        <div className="rounded-2xl p-6 bg-white" style={{ border: "1px solid #e2e8f0", boxShadow: "var(--card-shadow)" }}>
          <p className="text-sm font-semibold text-slate-800 mb-1">Vendor Risk Scatter</p>
          <p className="text-xs text-slate-400 mb-4">Invoice volume vs avg risk · bubble size = blocked count</p>
          <ReactECharts option={scatterOption} style={{ height: "240px" }} />
        </div>

        {/* Top risk vendors table */}
        <div className="rounded-2xl p-6 bg-white" style={{ border: "1px solid #e2e8f0", boxShadow: "var(--card-shadow)" }}>
          <p className="text-sm font-semibold text-slate-800 mb-1">Highest Risk Vendors</p>
          <p className="text-xs text-slate-400 mb-4">Ranked by average risk score</p>
          <div className="space-y-2">
            {topRisk.map((v, i) => {
              const riskColor = v.avg >= 65 ? "#dc2626" : v.avg >= 35 ? "#d97706" : "#059669";
              const riskBg = v.avg >= 65 ? "#fef2f2" : v.avg >= 35 ? "#fffbeb" : "#f0fdf4";
              return (
                <div
                  key={v.name}
                  onClick={() => { const inv = v.invoices[0]; if (inv) setSelectedInvoice(inv); }}
                  className="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors"
                  style={{ border: "1px solid #f1f5f9" }}
                >
                  <span className="text-xs font-bold text-slate-300 w-5 shrink-0">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{v.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${v.avg}%`, background: riskColor }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold px-2 py-1 rounded-lg" style={{ background: riskBg, color: riskColor }}>
                      {v.avg.toFixed(0)}
                    </span>
                    <p className="text-[10px] text-slate-400 mt-0.5">{v.blocked} blocked</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </div>
  );
});

export default VendorHeatmap;
