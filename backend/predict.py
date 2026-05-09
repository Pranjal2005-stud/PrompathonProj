"""
predict.py
----------
Enterprise hybrid fraud scoring engine.

Final risk score formula:
    risk_score = (ml_score * 0.45) + (rule_score * 0.40) + (behavior_score * 0.15)

Then adjusted by:
    - confidence penalty (pulls toward 45 for low-confidence invoices)
    - critical combination escalation (force_escalate from rule_engine)

Decision thresholds:
    0–35  → APPROVE
    35–65 → REVIEW
    65+   → BLOCK

Expected distribution on clean dataset:   80–90% APPROVE, 8–18% REVIEW, 1–5% BLOCK
Expected distribution on fraud dataset:   45–65% APPROVE, 20–35% REVIEW, 15–30% BLOCK
"""

import numpy as np
import pandas as pd
from rule_engine import apply_rules
from data_loader import load_vendor_master, load_price_benchmark

# ── ML feature list ───────────────────────────────────────────────────────────
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
    "underbilling_flag",
]

# ── Scoring weights ───────────────────────────────────────────────────────────
ML_WEIGHT       = 0.45
RULE_WEIGHT     = 0.40
BEHAVIOR_WEIGHT = 0.15

# ── Decision thresholds ───────────────────────────────────────────────────────
APPROVE_MAX = 35.0
REVIEW_MAX  = 65.0
# > REVIEW_MAX → BLOCK


def _enrich_external(df: pd.DataFrame) -> pd.DataFrame:
    """
    Merge vendor master for bank account mismatch and unknown vendor detection.
    Apply price benchmark flags.
    """
    vendor_master   = load_vendor_master()
    price_benchmark = load_price_benchmark()

    # ── Vendor master merge ───────────────────────────────────────────────────
    if (
        "vendor_name" in df.columns
        and not vendor_master.empty
        and "vendor_name" in vendor_master.columns
    ):
        extra = [c for c in vendor_master.columns
                 if c == "vendor_name" or c not in df.columns]
        df = df.merge(vendor_master[extra], on="vendor_name", how="left")

        # Unknown vendor: vendor_name not found in master
        df["unknown_vendor"] = df["vendor_name"].apply(
            lambda v: 0 if v in vendor_master["vendor_name"].values else 1
        )

        # Bank account mismatch: invoice bank != registered bank
        if "bank_account_x" in df.columns and "bank_account_y" in df.columns:
            df["bank_account_mismatch"] = (
                df["bank_account_x"].astype(str) != df["bank_account_y"].astype(str)
            ).astype(int)
            df = df.drop(columns=["bank_account_x", "bank_account_y"], errors="ignore")
        elif "bank_account" in df.columns:
            df["bank_account_mismatch"] = 0
        else:
            df["bank_account_mismatch"] = 0
    else:
        df["unknown_vendor"]        = 0
        df["bank_account_mismatch"] = 0

    # ── Price benchmark ───────────────────────────────────────────────────────
    def _price_flag(row):
        item = str(row.get("item_name", "") or "").strip()
        if not item or item in ("nan", "None", "unknown"):
            return "NORMAL"
        amount = float(row.get("invoice_amount", 0) or 0)
        if item in price_benchmark:
            lo = price_benchmark[item].get("min", 0)
            hi = price_benchmark[item].get("max", float("inf"))
            if amount > hi: return "OVERPRICED"
            if amount < lo: return "UNDERPRICED"
        return "NORMAL"

    df["price_flag"] = df.apply(_price_flag, axis=1)
    return df


def _normalize_ml_score(raw_scores: np.ndarray) -> np.ndarray:
    """
    Convert IsolationForest decision_function output to stable 0–100 score.

    Uses sigmoid-based normalization anchored at dataset percentiles:
    - p10 of raw scores → maps to ~20 (normal invoices stay low)
    - p90 of raw scores → maps to ~80 (anomalous invoices go high)

    This prevents clean datasets from spanning 0–100 and causing false BLOCKs.
    """
    if len(raw_scores) == 0:
        return np.array([])

    p10 = np.percentile(raw_scores, 10)
    p90 = np.percentile(raw_scores, 90)
    rng = p90 - p10

    if rng < 1e-6:
        # Uniform dataset — assign neutral score of 25 (well within APPROVE zone)
        return np.full_like(raw_scores, 25.0, dtype=float)

    # Linear scale anchored at p10→20, p90→80
    # This gives a 60-point spread across the middle of the 0–100 range
    scaled = 20.0 + 60.0 * (raw_scores - p10) / rng
    return np.clip(scaled, 0.0, 100.0)


def get_prediction(df: pd.DataFrame, model=None, scaler=None) -> pd.DataFrame:
    df = _enrich_external(df)

    # ── Ensure all ML features exist ─────────────────────────────────────────
    for col in FEATURES:
        if col not in df.columns:
            df[col] = 0.0
    X = df[FEATURES].copy().astype(float).fillna(0.0).clip(-10, 10)

    # ── Component 1: ML anomaly score (0–100) ─────────────────────────────────
    if model is not None and scaler is not None:
        try:
            X_scaled = scaler.transform(X)
            raw      = model.decision_function(X_scaled)
            # Negate: IsolationForest more negative = more anomalous
            df["anomaly_score"] = -raw
            df["ml_risk_score"] = _normalize_ml_score(-raw)
        except Exception as e:
            print(f"[predict] Model scoring failed, rule-only mode: {e}")
            df["anomaly_score"] = 0.0
            df["ml_risk_score"] = 25.0
    else:
        df["anomaly_score"] = 0.0
        df["ml_risk_score"] = 25.0

    # ── Component 2: Rule engine score (0–100) ────────────────────────────────
    df = apply_rules(df)
    # rule_score and force_escalate are now set on df

    # ── Component 3: Behavioral score (0–100) ────────────────────────────────
    # Already computed in feature_engineering as behavior_score
    if "behavior_score" not in df.columns:
        df["behavior_score"] = 0.0

    # ── Weighted blend ────────────────────────────────────────────────────────
    df["risk_score"] = (
        ML_WEIGHT       * df["ml_risk_score"]  +
        RULE_WEIGHT     * df["rule_score"]      +
        BEHAVIOR_WEIGHT * df["behavior_score"]
    ).clip(0.0, 100.0)

    # ── Confidence adjustment ─────────────────────────────────────────────────
    # Low-confidence invoices are pulled toward 45 (center of REVIEW zone).
    # This ensures incomplete invoices get REVIEW, not BLOCK.
    # High-confidence invoices are unaffected (conf=1.0 → no change).
    if "data_confidence" in df.columns:
        conf    = df["data_confidence"].clip(0.1, 1.0)
        neutral = 45.0
        df["risk_score"] = (
            df["risk_score"] * conf + neutral * (1.0 - conf)
        ).clip(0.0, 100.0)

    # ── Decision engine ───────────────────────────────────────────────────────
    def _decision(row) -> str:
        score      = float(row["risk_score"])
        conf       = float(row.get("data_confidence", 1.0))
        escalate   = bool(row.get("force_escalate", False))

        # Rule 1: Critical combination → always BLOCK if score ≥ 50
        if escalate and score >= 50.0:
            return "BLOCK"

        # Rule 2: Low confidence → REVIEW regardless of score
        # (incomplete data should not auto-block)
        if conf < 0.35:
            return "REVIEW"

        # Rule 3: Standard thresholds
        if score >= REVIEW_MAX:
            return "BLOCK"
        if score >= APPROVE_MAX:
            return "REVIEW"
        return "APPROVE"

    df["decision"] = df.apply(_decision, axis=1)

    # ── Human-readable reason ─────────────────────────────────────────────────
    def _reason(row) -> str:
        r = []

        # Financial
        if row["amount_vs_po"] > 1.4:                           r.append("Overbilling")
        if row["amount_deviation"] > 2.0:                       r.append("High Deviation")
        if row["payment_ratio"] > 1.15:                         r.append("Overpayment")
        if row["duplicate_pattern"] == 1:                       r.append("Duplicate Pattern")
        if row["missing_po"] == 1:                              r.append("Missing PO")
        if row["extreme_deviation"] == 1:                       r.append("Extreme Deviation")

        # Benchmark
        if row.get("price_flag") == "OVERPRICED":               r.append("Overpriced vs Benchmark")
        if row.get("price_flag") == "UNDERPRICED":              r.append("Suspiciously Low Price")

        # Patterns
        if row.get("split_invoice_flag", 0) == 1:               r.append("Split Invoice Pattern")
        if row.get("rounded_amount_flag", 0) == 1:              r.append("Rounded Amount")
        if row.get("payment_before_invoice", 0) == 1:           r.append("Payment Before Invoice")

        # Behavioral
        if row.get("weekend_invoice", 0) == 1:                  r.append("Weekend Invoice")
        if row.get("rapid_resubmission", 0) == 1:               r.append("Rapid Resubmission")
        if row.get("invoice_burst", 0) == 1:                    r.append("Invoice Burst")

        # Identity
        if row.get("unknown_vendor", 0) == 1:                   r.append("Unknown Vendor")
        if row.get("bank_account_mismatch", 0) == 1:            r.append("Bank Account Mismatch")

        # Data quality
        if row.get("data_confidence", 1.0) < 0.35:              r.append("Low Data Confidence")

        return ", ".join(r) if r else "Normal"

    df["reason"] = df.apply(_reason, axis=1)

    return df
