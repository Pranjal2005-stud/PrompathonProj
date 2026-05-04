import numpy as np
from rule_engine import apply_rules


FEATURES = [
    "invoice_amount",
    "amount_deviation",
    "amount_vs_po",
    "missing_po",
    "duplicate_pattern",
    "high_amount_flag",
    "payment_ratio",
    "quantity_vs_po",
    "days_since_last_invoice",
    "vendor_invoice_count",
    "extreme_deviation",
    "overpayment_flag",
    "underbilling_flag"
]


def get_prediction(df, model=None, scaler=None):

    # -------- Ensure all features exist --------
    for col in FEATURES:
        if col not in df.columns:
            df[col] = 0

    # -------- Prepare input --------
    X = df[FEATURES].copy().astype(float)

    # Clip extreme values
    X = X.clip(lower=-10, upper=10)

    # -------- ML Scoring --------
    if model is not None and scaler is not None:
        try:
            X_scaled = scaler.transform(X)
            raw_scores = model.decision_function(X_scaled)

            # Higher score = higher risk
            df["anomaly_score"] = -raw_scores

        except Exception as e:
            print(f"Model failed, fallback used: {e}")
            df["anomaly_score"] = 0.5
    else:
        df["anomaly_score"] = 0.5

    # -------- Normalize to Risk Score (0–100) --------
    min_score = df["anomaly_score"].min()
    max_score = df["anomaly_score"].max()
    score_range = max_score - min_score

    if score_range < 1e-6:
        df["risk_score"] = 50
    else:
        df["risk_score"] = 100 * (
            (df["anomaly_score"] - min_score) / score_range
        )

    # -------- BOOST risk using rules --------
    def boost_risk(row):
        boost = 0

        if row["amount_deviation"] > 0.7:
            boost += 20

        if row["duplicate_pattern"] == 1:
            boost += 25

        if row["high_amount_flag"] == 1:
            boost += 30

        if row["payment_ratio"] > 1.1:
            boost += 15

        return min(100, row["risk_score"] + boost)

    df["risk_score"] = df.apply(boost_risk, axis=1)

    # -------- Apply Rule Engine --------
    df = apply_rules(df)

    # -------- Final Decision --------
    def decision(row):

        # Hard fraud (absolute rules)
        if row["missing_po"] == 1:
            return "BLOCK"

        if row["amount_vs_po"] > 1.3:
            return "BLOCK"

        # Medium-risk conditions
        if (
            row["duplicate_pattern"] == 1
            or row.get("is_duplicate", 0) == 1
            or row["high_amount_flag"] == 1
            or row["amount_deviation"] > 0.7
            or row["payment_ratio"] > 1.1
        ):
            return "BLOCK" if row["risk_score"] > 50 else "REVIEW"

        # ML-based fallback
        if row["risk_score"] > 70:
            return "BLOCK"
        elif row["risk_score"] > 40:
            return "REVIEW"
        else:
            return "APPROVE"

    df["decision"] = df.apply(decision, axis=1)

    # -------- Explainability --------
    def generate_reason(row):
        reasons = []

        if row["amount_vs_po"] > 1.3:
            reasons.append("Overbilling")

        if row["amount_deviation"] > 0.7:
            reasons.append("High Deviation")

        if row["payment_ratio"] > 1.1:
            reasons.append("Overpayment")

        if row["duplicate_pattern"] == 1:
            reasons.append("Duplicate Pattern")

        if row["missing_po"] == 1:
            reasons.append("Missing PO")

        return ", ".join(reasons) if reasons else "Normal"

    df["reason"] = df.apply(generate_reason, axis=1)

    return df