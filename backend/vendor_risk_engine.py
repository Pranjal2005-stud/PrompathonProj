"""
vendor_risk_engine.py
---------------------
Aggregates per-vendor risk metrics from the scored invoice DataFrame.
Used by the /vendors API endpoint.
"""

import pandas as pd
from config import APPROVE_MAX, REVIEW_MAX, ALERT_CRITICAL, ALERT_HIGH, ALERT_MEDIUM


def compute_vendor_risk_summary(df: pd.DataFrame) -> list:
    if df.empty:
        return []

    records = []

    for vendor_name, grp in df.groupby("vendor_name"):
        avg_risk    = float(grp["risk_score"].mean())
        max_risk    = float(grp["risk_score"].max())
        blocked     = int((grp["decision"] == "BLOCK").sum())
        reviewed    = int((grp["decision"] == "REVIEW").sum())
        suspicious  = int((grp["risk_score"] >= 60).sum())
        invoice_cnt = len(grp)

        shared_bank  = int(grp["shared_bank_flag"].max()  if "shared_bank_flag"  in grp.columns else 0)
        shared_gst   = int(grp["shared_gst_flag"].max()   if "shared_gst_flag"   in grp.columns else 0)
        shell_vendor = int(grp["shell_vendor_flag"].max() if "shell_vendor_flag" in grp.columns else 0)
        net_risk     = float(grp["network_risk_score"].mean() if "network_risk_score" in grp.columns else 0)
        vendor_deg   = float(grp["vendor_degree"].max()   if "vendor_degree"     in grp.columns else 0)

        fraud_types: dict = {}
        if "fraud_type" in grp.columns:
            fraud_types = grp["fraud_type"].value_counts().to_dict()

        if avg_risk >= ALERT_CRITICAL:
            alert_level = "CRITICAL"
        elif avg_risk >= ALERT_HIGH:
            alert_level = "HIGH"
        elif avg_risk >= ALERT_MEDIUM:
            alert_level = "MEDIUM"
        else:
            alert_level = "LOW"

        records.append({
            "vendor_name":         str(vendor_name),
            "vendor_id":           str(grp["vendor_id"].iloc[0]) if "vendor_id" in grp.columns else str(vendor_name),
            "invoice_count":       invoice_cnt,
            "avg_risk_score":      round(avg_risk, 1),
            "max_risk_score":      round(max_risk, 1),
            "blocked_count":       blocked,
            "review_count":        reviewed,
            "suspicious_count":    suspicious,
            "shared_bank_account": shared_bank,
            "shared_gst":          shared_gst,
            "shell_vendor_flag":   shell_vendor,
            "network_risk_score":  round(net_risk, 1),
            "vendor_degree":       round(vendor_deg, 1),
            "fraud_types":         fraud_types,
            "alert_level":         alert_level,
        })

    records.sort(key=lambda x: -x["avg_risk_score"])
    return records


# Backward-compat alias
def compute_vendor_risk(df: pd.DataFrame) -> list:
    return compute_vendor_risk_summary(df)
