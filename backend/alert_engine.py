"""
alert_engine.py
---------------
Generates fraud alerts from a scored DataFrame.
Returns all BLOCK and REVIEW invoices sorted by risk_score descending.
Does NOT write to disk (removed file I/O that caused crashes).
"""

from datetime import datetime

from explain import explain_row
from config import ALERT_CRITICAL, ALERT_HIGH, ALERT_MEDIUM


def get_severity(score: float) -> str:
    if score >= ALERT_CRITICAL: return "CRITICAL"
    if score >= ALERT_HIGH:     return "HIGH"
    if score >= ALERT_MEDIUM:   return "MEDIUM"
    return "LOW"


def recommended_action(score: float) -> str:
    if score >= ALERT_CRITICAL:
        return "Immediately block payment and escalate investigation."
    if score >= ALERT_HIGH:
        return "Hold payment for manual review."
    if score >= ALERT_MEDIUM:
        return "Request supporting procurement documents."
    return "Continue monitoring vendor activity."


def generate_alerts(df) -> list:
    """
    Return a list of alert dicts for all BLOCK/REVIEW invoices,
    plus any force_escalated invoices, sorted by risk_score descending.
    """
    import pandas as pd

    # Build alert mask — include REVIEW too so alerts panel is populated
    mask = (df["decision"].isin(["BLOCK", "REVIEW"]))

    # Also include force_escalated rows even if decision is APPROVE
    if "force_escalate" in df.columns:
        mask = mask | (df["force_escalate"].fillna(False).astype(bool))

    alert_df = df[mask].sort_values("risk_score", ascending=False)

    alerts = []
    ts = str(datetime.now())

    for _, row in alert_df.iterrows():
        risk_score = round(float(row.get("risk_score", 0)), 2)

        # rule_flags may be a string or list — normalise to string
        raw_flags = row.get("rule_flags", "")
        if isinstance(raw_flags, list):
            flags_str = ", ".join(str(f) for f in raw_flags)
        else:
            flags_str = str(raw_flags or "")

        alert = {
            "timestamp":          ts,
            "severity":           get_severity(risk_score),
            "alert_level":        row.get("alert_level", get_severity(risk_score)),
            "invoice_id":         str(row.get("invoice_id", "UNKNOWN")),
            "vendor_id":          str(row.get("vendor_id", "UNKNOWN")),
            "vendor_name":        str(row.get("vendor_name", "Unknown")),
            "invoice_amount":     float(row.get("invoice_amount", 0) or 0),
            "risk_score":         risk_score,
            "ml_risk_score":      round(float(row.get("ml_risk_score", 0) or 0), 2),
            "rule_score":         round(float(row.get("rule_score", 0) or 0), 2),
            "decision":           row.get("decision", "REVIEW"),
            "fraud_type":         row.get("fraud_type", "Unknown"),
            "fraud_flags":        flags_str,
            "rule_flags":         flags_str,
            "reason":             str(row.get("reason", flags_str)),
            "vendor_degree":      int(row.get("vendor_degree", 0) or 0),
            "cluster_size":       int(row.get("cluster_size", 0) or 0),
            "co_occurrence_score": round(float(row.get("co_occurrence_score", 0) or 0), 2),
            "shell_vendor_flag":  int(row.get("shell_vendor_flag", 0) or 0),
            "shared_bank_flag":   int(row.get("shared_bank_flag", 0) or 0),
            "network_risk_score": round(float(row.get("network_risk_score", 0) or 0), 2),
            "explanation":        explain_row(row.to_dict()),
            "recommended_action": recommended_action(risk_score),
        }
        alerts.append(alert)

    return alerts
