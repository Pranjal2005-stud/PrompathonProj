import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  BarChart, Bar,
} from "recharts";
import { motion } from "framer-motion";

const TOOLTIP_STYLE = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  color: "#0f172a",
  fontSize: "12px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
  padding: "8px 12px",
};

const AXIS_STYLE = { fontSize: 11, fill: "#94a3b8" };
const GRID_COLOR = "#f1f5f9";

function Card({ title, sub, children }) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
      className="rounded-xl p-6 flex flex-col"
      style={{
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        transition: "box-shadow 0.2s",
      }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.08)"}
      onMouseLeave={e => e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)"}
    >
      <div className="mb-5">
        <p className="text-sm font-semibold text-slate-700">{title}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
      {children}
    </motion.div>
  );
}

const PieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.05) return null;
  const R = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + r * Math.cos(-midAngle * R);
  const y = cy + r * Math.sin(-midAngle * R);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export default function Charts({ data = [], loading }) {
  const counts = { APPROVE: 0, REVIEW: 0, BLOCK: 0 };
  data.forEach(d => { if (counts[d.decision] !== undefined) counts[d.decision]++; });
  const total = data.length || 1;

  const pieData = [
    { name: "Approved", value: counts.APPROVE },
    { name: "Review",   value: counts.REVIEW  },
    { name: "Blocked",  value: counts.BLOCK   },
  ];
  const PIE_COLORS = ["#059669", "#d97706", "#dc2626"];

  const trendData = data.slice(0, 30).map((d, i) => ({
    n: i + 1,
    score: parseFloat((d.risk_score || 0).toFixed(1)),
  }));

  const fraudTypes = {
    Overbilling: 0, Duplicate: 0, "Missing PO": 0, Overpayment: 0, "High Dev": 0,
  };
  data.forEach(d => {
    if ((d.reason || "").includes("Overbilling"))    fraudTypes.Overbilling++;
    if ((d.reason || "").includes("Duplicate"))      fraudTypes.Duplicate++;
    if ((d.reason || "").includes("Missing PO"))     fraudTypes["Missing PO"]++;
    if ((d.reason || "").includes("Overpayment"))    fraudTypes.Overpayment++;
    if ((d.reason || "").includes("High Deviation")) fraudTypes["High Dev"]++;
  });
  const barData = Object.entries(fraudTypes).map(([name, count]) => ({ name, count }));
  const BAR_COLORS = ["#dc2626", "#d97706", "#f97316", "#7c3aed", "#2563eb"];

  if (loading) return (
    <div className="grid grid-cols-3 gap-5">
      {[1, 2, 3].map(i => <div key={i} className="skeleton rounded-xl h-64" />)}
    </div>
  );

  return (
    <div className="grid grid-cols-3 gap-5">

      {/* Donut — Decision Breakdown */}
      <Card title="Decision Breakdown" sub="Invoice outcome distribution">
        <ResponsiveContainer width="100%" height={210}>
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              cx="50%" cy="46%"
              outerRadius={80} innerRadius={46}
              labelLine={false}
              label={<PieLabel />}
              paddingAngle={2}
            >
              {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
            </Pie>
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(v, n) => [`${v} invoices`, n]}
            />
            <Legend
              iconType="circle"
              iconSize={7}
              wrapperStyle={{ fontSize: "11px", color: "#64748b", paddingTop: "10px" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </Card>

      {/* Area — Risk Score Trend */}
      <Card title="Risk Score Trend" sub="Per-invoice anomaly score (first 30)">
        <ResponsiveContainer width="100%" height={210}>
          <AreaChart data={trendData} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#2563eb" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#2563eb" stopOpacity={0}    />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={GRID_COLOR} strokeDasharray="0" vertical={false} />
            <XAxis
              dataKey="n"
              tick={AXIS_STYLE}
              axisLine={false}
              tickLine={false}
              interval={4}
              label={{ value: "Invoice #", position: "insideBottom", offset: -2, style: { fontSize: 10, fill: "#94a3b8" } }}
            />
            <YAxis
              tick={AXIS_STYLE}
              axisLine={false}
              tickLine={false}
              domain={[0, 100]}
              width={28}
              label={{ value: "Risk", angle: -90, position: "insideLeft", offset: 12, style: { fontSize: 10, fill: "#94a3b8" } }}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={v => [`${v}`, "Risk Score"]}
              labelFormatter={l => `Invoice #${l}`}
            />
            <Area
              type="monotone"
              dataKey="score"
              stroke="#2563eb"
              strokeWidth={2}
              fill="url(#rg)"
              dot={false}
              activeDot={{ r: 3, fill: "#2563eb", strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* Bar — Fraud Type Breakdown */}
      <Card title="Fraud Type Breakdown" sub="Detected fraud categories">
        <ResponsiveContainer width="100%" height={210}>
          <BarChart data={barData} barSize={22} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
            <CartesianGrid stroke={GRID_COLOR} strokeDasharray="0" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ ...AXIS_STYLE, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              label={{ value: "Category", position: "insideBottom", offset: -2, style: { fontSize: 10, fill: "#94a3b8" } }}
            />
            <YAxis
              tick={AXIS_STYLE}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              width={24}
              label={{ value: "Count", angle: -90, position: "insideLeft", offset: 12, style: { fontSize: 10, fill: "#94a3b8" } }}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={v => [`${v} invoice(s)`, "Count"]}
              cursor={{ fill: "#f8fafc" }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {barData.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

    </div>
  );
}
