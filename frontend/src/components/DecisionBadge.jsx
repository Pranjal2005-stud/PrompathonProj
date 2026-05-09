export default function DecisionBadge({ decision }) {
  const s = {
    APPROVE: { background: "#f0fdf4", color: "#059669", border: "1px solid #bbf7d0" },
    REVIEW:  { background: "#fffbeb", color: "#d97706", border: "1px solid #fde68a" },
    BLOCK:   { background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" },
  }[decision] || { background: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0" };

  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
      style={s}
    >
      {decision ?? "—"}
    </span>
  );
}
