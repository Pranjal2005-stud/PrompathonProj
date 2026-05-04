export default function DecisionBadge({ decision }) {
  const styles = {
    APPROVE: { background: "rgba(16,185,129,0.1)",  color: "#059669", borderColor: "rgba(16,185,129,0.25)" },
    REVIEW:  { background: "rgba(245,158,11,0.1)",  color: "#d97706", borderColor: "rgba(245,158,11,0.25)" },
    BLOCK:   { background: "rgba(239,68,68,0.1)",   color: "#dc2626", borderColor: "rgba(239,68,68,0.25)" },
  };
  const s = styles[decision] || { background: "rgba(100,116,139,0.1)", color: "#475569", borderColor: "rgba(100,116,139,0.2)" };

  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border"
      style={s}>
      {decision ?? "—"}
    </span>
  );
}
