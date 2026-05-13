"""
utils.py
--------
Summary statistics for the /summary endpoint.
"""

import pandas as pd


def calculate_summary(df: pd.DataFrame) -> dict:
    if df.empty:
        return {"total": 0, "blocked": 0, "review": 0, "approved": 0,
                "fraud_rate": 0.0, "avg_risk": 0.0, "leakage_prevented": 0.0,
                "vendors_flagged": 0, "top_fraud_types": []}

    total    = len(df)
    blocked  = int((df["decision"] == "BLOCK").sum())
    review   = int((df["decision"] == "REVIEW").sum())
    approved = int((df["decision"] == "APPROVE").sum())

    avg_risk = float(df["risk_score"].mean()) if "risk_score" in df.columns else 0.0
    fraud_rate = round(blocked / total * 100, 2) if total else 0.0

    leakage = float(
        df.loc[df["decision"] == "BLOCK", "invoice_amount"].sum()
    ) if "invoice_amount" in df.columns else 0.0

    vendors_flagged = int(
        df.loc[df["decision"] == "BLOCK", "vendor_name"].nunique()
    ) if "vendor_name" in df.columns else 0

    # Top fraud types from reason column
    fraud_types: dict = {}
    if "reason" in df.columns:
        for reasons in df["reason"].dropna():
            for flag in str(reasons).split(","):
                flag = flag.strip()
                if flag and flag != "Normal":
                    fraud_types[flag] = fraud_types.get(flag, 0) + 1

    top_fraud_types = sorted(
        [{"type": k, "count": v} for k, v in fraud_types.items()],
        key=lambda x: x["count"], reverse=True
    )[:8]

    return {
        "total":            total,
        "blocked":          blocked,
        "review":           review,
        "approved":         approved,
        "fraud_rate":       fraud_rate,
        "avg_risk":         round(avg_risk, 2),
        "leakage_prevented": leakage,
        "vendors_flagged":  vendors_flagged,
        "top_fraud_types":  top_fraud_types,
    }
