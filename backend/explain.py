def generate_reason(row):

    # Prefer rule-based explanation
    if row.get("rule_flags") and row["rule_flags"] != "None":
        return row["rule_flags"]

    # ML fallback
    risk = row.get("risk_score", 0)

    if risk > 60:
        return f"ML model flagged high anomaly risk (score: {risk:.1f})"
    elif risk > 30:
        return f"ML model flagged moderate anomaly risk (score: {risk:.1f})"

    return "Normal"