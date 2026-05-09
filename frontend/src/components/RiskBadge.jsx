export default function RiskBadge({ score }) {
  const val = score ?? 0;
  const style =
    val > 70
      ? { background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }
      : val > 40
      ? { background: "#fffbeb", color: "#d97706", border: "1px solid #fde68a" }
      : { background: "#f0fdf4", color: "#059669", border: "1px solid #bbf7d0" };

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
      style={style}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: style.color }} />
      {val.toFixed(1)}
    </span>
  );
}
