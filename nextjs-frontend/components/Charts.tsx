"use client";
import { useMemo, memo } from "react";
import ReactECharts from "echarts-for-react";
import { useAppStore } from "@/store";
import { Card, Skeleton } from "@/components/ui/primitives";

const PIE_COLORS = ["#dc2626", "#7c3aed", "#d97706", "#2563eb", "#059669", "#ea580c"];

const Charts = memo(function Charts() {
  const { invoices: data, loading } = useAppStore();

  const { pieData, trendData, vendorBar } = useMemo(() => {
    const fraudTypeCounts: Record<string, number> = {};
    data.forEach((d) => {
      const ft = d.fraud_type ?? "";
      if (ft && ft !== "Normal") {
        fraudTypeCounts[ft] = (fraudTypeCounts[ft] ?? 0) + 1;
      } else {
        const fl = d.rule_flags ?? d.reason ?? "";
        if (fl.includes("Split Invoice"))  fraudTypeCounts["Invoice Splitting"]    = (fraudTypeCounts["Invoice Splitting"]    ?? 0) + 1;
        if (fl.includes("Unknown Vendor")) fraudTypeCounts["Shell Vendor"]          = (fraudTypeCounts["Shell Vendor"]          ?? 0) + 1;
        if (fl.includes("Duplicate"))      fraudTypeCounts["Duplicate Invoice"]     = (fraudTypeCounts["Duplicate Invoice"]     ?? 0) + 1;
        if (fl.includes("Overbilling"))    fraudTypeCounts["Overbilling"]           = (fraudTypeCounts["Overbilling"]           ?? 0) + 1;
      }
    });
    const pie = Object.entries(fraudTypeCounts)
      .map(([name, value]) => ({ name: name.replace(" Fraud", ""), value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    const trend = data.slice(0, 60).map((d, i) => ({
      n: i + 1,
      score: parseFloat((d.risk_score ?? 0).toFixed(1)),
      ml: parseFloat((d.ml_risk_score ?? 0).toFixed(1)),
    }));

    const vendorMap: Record<string, { scores: number[] }> = {};
    data.forEach((d) => {
      if (!d.vendor_name) return;
      if (!vendorMap[d.vendor_name]) vendorMap[d.vendor_name] = { scores: [] };
      vendorMap[d.vendor_name].scores.push(d.risk_score ?? 0);
    });
    const vbar = Object.entries(vendorMap)
      .map(([name, v]) => ({
        name: name.length > 12 ? name.substring(0, 12) + "…" : name,
        avg: parseFloat((v.scores.reduce((a, b) => a + b, 0) / v.scores.length).toFixed(1)),
      }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 8);

    return { pieData: pie, trendData: trend, vendorBar: vbar };
  }, [data]);

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-5">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="rounded-2xl h-64" />)}
      </div>
    );
  }

  const tooltipStyle = {
    backgroundColor: "#0f172a",
    borderColor: "#1e293b",
    textStyle: { color: "#f8fafc", fontSize: 12 },
  };

  const pieOption = {
    tooltip: { ...tooltipStyle, trigger: "item", formatter: "{b}: {c} ({d}%)" },
    legend: {
      orient: "horizontal",
      bottom: 0,
      left: "center",
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { fontSize: 9, color: "#64748b" },
      formatter: (name: string) => name.length > 14 ? name.substring(0, 14) + "…" : name,
    },
    series: [{
      type: "pie",
      radius: ["38%", "62%"],
      center: ["50%", "42%"],
      data: pieData.map((d, i) => ({
        ...d,
        itemStyle: { color: PIE_COLORS[i % PIE_COLORS.length] },
      })),
      label: {
        show: true,
        position: "inside",
        formatter: "{d}%",
        fontSize: 10,
        fontWeight: "bold",
        color: "#fff",
      },
      labelLine: { show: false },
      emphasis: { itemStyle: { shadowBlur: 8, shadowColor: "rgba(0,0,0,0.2)" } },
    }],
  };

  const trendOption = {
    tooltip: { ...tooltipStyle, trigger: "axis", axisPointer: { type: "cross" } },
    legend: {
      top: 0,
      right: 0,
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { fontSize: 9, color: "#64748b" },
      data: ["ML Score", "Risk Score"],
    },
    grid: { top: 24, right: 12, bottom: 24, left: 36 },
    xAxis: {
      type: "category",
      data: trendData.map((d) => d.n),
      axisLabel: { fontSize: 9, color: "#94a3b8" },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      min: 0,
      max: 100,
      axisLabel: { fontSize: 9, color: "#94a3b8" },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: "#f1f5f9" } },
    },
    series: [
      {
        name: "ML Score",
        type: "line",
        data: trendData.map((d) => d.ml),
        smooth: true,
        symbol: "none",
        lineStyle: { color: "#2563eb", width: 1.5 },
        areaStyle: {
          color: {
            type: "linear", x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(37,99,235,0.10)" },
              { offset: 1, color: "rgba(37,99,235,0)" },
            ],
          },
        },
      },
      {
        name: "Risk Score",
        type: "line",
        data: trendData.map((d) => d.score),
        smooth: true,
        symbol: "none",
        lineStyle: { color: "#dc2626", width: 2 },
        areaStyle: {
          color: {
            type: "linear", x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(220,38,38,0.12)" },
              { offset: 1, color: "rgba(220,38,38,0)" },
            ],
          },
        },
      },
    ],
  };

  const barOption = {
    tooltip: { ...tooltipStyle, trigger: "axis", axisPointer: { type: "shadow" } },
    // containLabel ensures axis labels don't overflow the card
    grid: { top: 8, right: 16, bottom: 8, left: 8, containLabel: true },
    xAxis: {
      type: "value",
      max: 100,
      axisLabel: { show: false },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
    },
    yAxis: {
      type: "category",
      data: vendorBar.map((d) => d.name),
      axisLabel: { fontSize: 10, color: "#475569", width: 80, overflow: "truncate" },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [{
      type: "bar",
      data: vendorBar.map((d) => ({
        value: d.avg,
        itemStyle: {
          color: d.avg >= 65 ? "#dc2626" : d.avg >= 35 ? "#d97706" : "#059669",
          borderRadius: [0, 4, 4, 0],
        },
      })),
      // Label inside bar to prevent overflow
      label: {
        show: true,
        position: "insideRight",
        fontSize: 10,
        fontWeight: "bold",
        color: "#fff",
        formatter: (p: { value: number }) => p.value.toFixed(0),
      },
      barMaxWidth: 16,
    }],
  };

  return (
    <div className="grid grid-cols-3 gap-5">
      <Card title="Fraud Type Distribution" sub="By category">
        {pieData.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-slate-400">
            No fraud detected
          </div>
        ) : (
          <ReactECharts option={pieOption} style={{ height: "220px" }} />
        )}
      </Card>

      <Card title="Risk Score Trend" sub="Per-invoice (first 60)">
        <ReactECharts option={trendOption} style={{ height: "220px" }} />
      </Card>

      <Card title="Vendor Risk Comparison" sub="Top vendors by avg risk">
        {vendorBar.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-slate-400">
            No vendor data
          </div>
        ) : (
          <ReactECharts option={barOption} style={{ height: "220px" }} />
        )}
      </Card>
    </div>
  );
});

export default Charts;
