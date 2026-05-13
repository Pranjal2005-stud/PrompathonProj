"""
alert_engine.py
---------------
Generates structured fraud alerts from scored invoice DataFrame.
Severity: CRITICAL (>=85), HIGH (65-84), MEDIUM (45-64), LOW (<45)
"""

from datetime import datetime
import pandas as pd


def generate_alerts(df: pd.DataFrame) -> list:
    """
    Returns list of alert dicts for invoices with risk_score >= 45
    or decision == BLOCK, sorted by severity then risk_score desc.
    """
    if df.empty:
        return []

    alert_rows = df[
        (df["risk_score"] >= 45) |
        (df["decision"] == "BLOCK")
    ].copy()

    if alert_rows.empty:
        return []

    alerts = []
    for _, row in alert_rows.iterrows():
        risk  = float(row.get("risk_score", 0) or 0)
        flags = str(row.get("rule_flags", "") or row.get("reason", "") or "")
        fraud_type = str(row.get("fraud_type", "") or "")

        if risk >= 85:
            severity = "CRITICAL"
        elif risk >= 65:
            severity = "HIGH"
        elif risk >= 45:
            severity = "MEDIUM"
        else:
            severity = "LOW"

        # Build human-readable message
        if "Split Invoice" in flags or "Split Invoice" in fraud_type:
            message = f"Split invoice cluster detected — {row.get('vendor_name', 'Unknown')}"
        elif "Unknown Vendor" in flags or "Shell" in fraud_type:
            message = f"Shell vendor detected — {row.get('vendor_name', 'Unknown')}"
        elif "Bank Account Mismatch" in flags or "Shared Bank" in flags:
            message = f"Shared bank account linked to multiple vendors"
        elif "Duplicate" in flags:
            message = f"Duplicate invoice pattern — {row.get('vendor_name', 'Unknown')}"
        elif "Overbilling" in flags:
            message = f"Overbilling detected — {row.get('vendor_name', 'Unknown')}"
        else:
            message = f"Suspicious invoice — {row.get('vendor_name', 'Unknown')}"

        alerts.append({
            "invoice_id":         str(row.get("invoice_id", "") or ""),
            "vendor_id":          str(row.get("vendor_id", "") or ""),
            "vendor_name":        str(row.get("vendor_name", "") or "Unknown"),
            "invoice_amount":     float(row.get("invoice_amount", 0) or 0),
            "risk_score":         round(risk, 1),
            "decision":           str(row.get("decision", "") or ""),
            "rule_flags":         flags,
            "fraud_type":         fraud_type,
            "alert_level":        severity,
            "severity":           severity,
            "message":            message,
            "network_risk_score": float(row.get("network_risk_score", 0) or 0),
            "shared_bank_account": int(row.get("shared_bank_account", 0) or 0),
            "created_at":         str(row.get("created_at", "") or datetime.utcnow().date()),
            "timestamp":          datetime.utcnow().isoformat(),
        })

    # Sort: CRITICAL first, then by risk_score desc
    severity_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
    alerts.sort(key=lambda a: (severity_order.get(a["severity"], 9), -a["risk_score"]))
    return alerts
