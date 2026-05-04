import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  BarChart, Bar,
} from "recharts";

const CARD = { background: "rgba(255,255,255,0.3)", backdropFilter: "blur(20px)", borderColor: "rgba(255,255,255,0.5)", boxShadow: "0 4px 24px rgba(99,102,241,0.08)" };
const TT = { background: "rgba(255,255,255,0.95)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: "12px", color: "#1e293b", fontSize: "12px", boxShadow: "0 8px 24px rgba(0,0,0,0.1)" };

function SkeletonChart() {
  return <div className="h-48 rounded-xl bg-slate-100 animate-pulse" />;
}

export default function Charts({ data = [], loading }) {
  const counts = { APPROVE: 0, REVIEW: 0, BLOCK: 0 };
  data.forEach((d) => { if (counts[d.decision] !== undefined) counts[d.decision]++; });
  const total = data.length || 1;

  const pieData = [
    { name: "Approve", value: counts.APPROVE, pct: ((counts.APPROVE / total) * 100).toFixed(0) },
    { name: "Review", value: counts.REVIEW, pct: ((counts.REVIEW / total) * 100).toFixed(0) },
    { name: "Block", value: counts.BLOCK, pct: ((counts.BLOCK / total) * 100).toFixed(0) },
  ];
  const PIE_COLORS = ["#10b981", "#f59e0b", "#ef4444"];

  const trendData = data.slice(0, 30).map((d, i) => ({
    name: `#${i + 1}`,
    risk: parseFloat((d.risk_score || 0).toFixed(1)),
  }));

  const barData = [
    { range: "Low (0–30)", count: data.filter((d) => (d.risk_score || 0) <= 30).length, fill: "#10b981" },
    { range: "Med (31–70)", count: data.filter((d) => (d.risk_score || 0) > 30 && (d.risk_score || 0) <= 70).length, fill: "#f59e0b" },
    { range: "High (71+)", count: data.filter((d) => (d.risk_score || 0) > 70).length, fill: "#ef4444" },
  ];

  const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, pct }) => {
    const RADIAN = Math.PI / 180;
    const r = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + r * Math.cos(-midAngle * RADIAN);
    const y = cy + r * Math.sin(-midAngle * RADIAN);
    return pct > 5 ? <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>{pct}%</text> : null;
  };

  return (
    <div className="grid grid-cols-3 gap-5">

      {/* Doughnut */}
      <div className="rounded-2xl p-5 border" style={CARD}>
        <p className="text-sm font-semibold text-slate-800 mb-1">Decision Breakdown</p>
        <p className="text-xs text-slate-600 mb-4">Approve / Review / Block</p>
        {loading ? <SkeletonChart /> : (
          <PieChart width={220} height={190}>
            <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={80} innerRadius={45} labelLine={false} label={<CustomLabel />}>
              {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
            </Pie>
            <Tooltip contentStyle={TT} formatter={(v, n, p) => [`${v} (${p.payload.pct}%)`, n]} />
            <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: "11px" }} />
          </PieChart>
        )}
      </div>

      {/* Area Line */}
      <div className="rounded-2xl p-5 border" style={CARD}>
        <p className="text-sm font-semibold text-slate-800 mb-1">Risk Score Trend</p>
        <p className="text-xs text-slate-600 mb-4">Per invoice (first 30)</p>
        {loading ? <SkeletonChart /> : (
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" stroke="#cbd5e1" tick={{ fontSize: 10 }} />
              <YAxis stroke="#cbd5e1" tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={TT} />
              <Area type="monotone" dataKey="risk" stroke="#6366f1" strokeWidth={2.5} fill="url(#riskGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Bar */}
      <div className="rounded-2xl p-5 border" style={CARD}>
        <p className="text-sm font-semibold text-slate-800 mb-1">Risk Distribution</p>
        <p className="text-xs text-slate-600 mb-4">Low / Medium / High buckets</p>
        {loading ? <SkeletonChart /> : (
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={barData} barSize={36}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="range" stroke="#cbd5e1" tick={{ fontSize: 10 }} />
              <YAxis stroke="#cbd5e1" tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={TT} />
              <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                {barData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

    </div>
  );
}
