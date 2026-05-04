export default function RiskBadge({ score }) {
  const val = score ?? 0;
  let style, dot;
  if (val > 70) { style = { background: "rgba(239,68,68,0.1)", color: "#dc2626", border: "rgba(239,68,68,0.2)" }; dot = "#ef4444"; }
  else if (val > 40) { style = { background: "rgba(245,158,11,0.1)", color: "#d97706", border: "rgba(245,158,11,0.2)" }; dot = "#f59e0b"; }
  else { style = { background: "rgba(16,185,129,0.1)", color: "#059669", border: "rgba(16,185,129,0.2)" }; dot = "#10b981"; }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border"
      style={{ background: style.background, color: style.color, borderColor: style.border }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: dot }} />
      {val.toFixed(1)}
    </span>
  );
}
