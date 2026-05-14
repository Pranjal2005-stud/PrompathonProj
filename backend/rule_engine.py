"""
rule_engine.py
--------------
Enterprise procurement fraud rule engine.

All rules are vectorized (no iterrows).
Scores are deterministic and capped at MAX_RULE_SCORE.
Flags are deduplicated strings, not lists.
Fraud type is assigned once from a priority-ordered check.
"""

import logging

import pandas as pd

from config import (
    OVERBILLING_RATIO,
    QUANTITY_MISMATCH_RATIO,
    OVERPAYMENT_RATIO,
    UNDERBILLING_RATIO,
    HIGH_DEVIATION_IQR,
    EXTREME_DEVIATION_IQR,
    THRESHOLD_HUG_LOW,
    THRESHOLD_HUG_HIGH,
    APPROVAL_THRESHOLD,
    GRAPH_HIGH_DEGREE,
    CO_OCCURRENCE_HIGH,
    MAX_RULE_SCORE,
    FIRST_INVOICE_MULTIPLIER,
)

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Rule weight registry
# ---------------------------------------------------------------------------
RULE_WEIGHTS: dict[str, int] = {
    # Financial
    "Duplicate Invoice":        35,
    "Overbilling":              28,
    "Extreme Deviation":        25,
    "Overpriced vs Benchmark":  25,
    "Split Invoice Pattern":    25,
    "Threshold Avoidance":      24,
    "Overpayment":              22,
    "Threshold Hugging":        22,
    "Quantity Mismatch":        20,
    "First Invoice High Value": 18,
    "High Deviation":           15,
    "Suspiciously Low Price":   15,
    "Underbilling":             13,
    # Identity / vendor
    "Bank Account Mismatch":    35,
    "Shared Bank Account":      30,
    "Shared GST":               28,
    "Shell Vendor":             30,
    "Unknown Vendor":           20,
    "Vendor Collusion":         32,
    # Graph / network
    "Coordinated Activity":     25,
    # Behavioral
    "Payment Before Invoice":   20,
    "Invoice Burst":            15,
    "Rapid Resubmission":       12,
    "Rounded Amount":           10,
    "Weekend Invoice":           8,
    # PO / process
    "Missing PO":               18,
    # Data quality (no score impact)
    "Low Data Confidence":       0,
}

# Critical combos → force_escalate = True
CRITICAL_COMBINATIONS: list[frozenset] = [
    frozenset({"Duplicate Invoice",    "Overpayment"}),
    frozenset({"Overbilling",          "Split Invoice Pattern"}),
    frozenset({"Unknown Vendor",       "Bank Account Mismatch"}),
    frozenset({"Unknown Vendor",       "Extreme Deviation"}),
    frozenset({"Bank Account Mismatch","Payment Before Invoice"}),
    frozenset({"Shared Bank Account",  "Unknown Vendor"}),
    frozenset({"Shell Vendor",         "Shared Bank Account"}),
    frozenset({"Threshold Avoidance",  "Split Invoice Pattern"}),
    frozenset({"Vendor Collusion",     "Shared GST"}),
    frozenset({"Duplicate Invoice",    "Rapid Resubmission"}),
]

# Fraud type priority (first match wins)
_FRAUD_PRIORITY = [
    ("Vendor Collusion",        "Coordinated Procurement Fraud"),
    ("Shell Vendor",            "Shell Vendor Fraud"),
    ("Shared Bank Account",     "Shell Vendor Fraud"),
    ("Shared GST",              "Shell Vendor Fraud"),
    ("Threshold Avoidance",     "Threshold Avoidance Fraud"),
    ("Split Invoice Pattern",   "Invoice Splitting Fraud"),
    ("Unknown Vendor",          "Shell Vendor Fraud"),
    ("Bank Account Mismatch",   "Shell Vendor Fraud"),
    ("Duplicate Invoice",       "Duplicate Invoice Fraud"),
    ("Overbilling",             "Overbilling Fraud"),
    ("Overpriced vs Benchmark", "Overbilling Fraud"),
    ("Overpayment",             "Overpayment Fraud"),
    ("Coordinated Activity",    "Coordinated Procurement Fraud"),
]


def apply_rules(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["rule_flags"]     = ""
    df["rule_score"]     = 0.0
    df["force_escalate"] = False

    def flag(mask: pd.Series, label: str) -> None:
        """Append label to rule_flags and add weight to rule_score."""
        m = mask.fillna(False).astype(bool)
        if not m.any():
            return
        weight = RULE_WEIGHTS.get(label, 5)
        df.loc[m, "rule_flags"] += label + ", "
        df.loc[m, "rule_score"] += weight

    # ── Financial ─────────────────────────────────────────────────────────────
    if "amount_vs_po" in df.columns:
        flag(df["amount_vs_po"] > OVERBILLING_RATIO,  "Overbilling")
        flag(df["underbilling_flag"] == 1,             "Underbilling")

    if "quantity_vs_po" in df.columns:
        flag(df["quantity_vs_po"] > QUANTITY_MISMATCH_RATIO, "Quantity Mismatch")

    if "missing_po" in df.columns:
        flag(df["missing_po"] == 1, "Missing PO")

    if "is_duplicate" in df.columns:
        flag(df["is_duplicate"] == 1, "Duplicate Invoice")

    # Mutually exclusive deviation rules
    if "amount_deviation" in df.columns and "extreme_deviation" in df.columns:
        flag(
            (df["amount_deviation"] > HIGH_DEVIATION_IQR) & (df["extreme_deviation"] != 1),
            "High Deviation",
        )
        flag(df["extreme_deviation"] == 1, "Extreme Deviation")

    if "payment_ratio" in df.columns:
        flag(df["payment_ratio"] > OVERPAYMENT_RATIO, "Overpayment")

    # Threshold hugging: invoice at 90–99.9% of approval limit
    if "invoice_amount" in df.columns:
        ratio = df["invoice_amount"] / APPROVAL_THRESHOLD
        flag(ratio.between(THRESHOLD_HUG_LOW, THRESHOLD_HUG_HIGH), "Threshold Hugging")

    # First invoice high value
    if "vendor_invoice_count" in df.columns:
        dataset_median = float(df["invoice_amount"].median())
        flag(
            (df["vendor_invoice_count"] == 1) &
            (df["invoice_amount"] > FIRST_INVOICE_MULTIPLIER * dataset_median),
            "First Invoice High Value",
        )

    # ── Split / threshold avoidance ───────────────────────────────────────────
    if "split_cluster_flag" in df.columns:
        flag(df["split_cluster_flag"] == 1, "Split Invoice Pattern")

    if "cluster_amount_ratio" in df.columns and "window_invoice_count" in df.columns:
        cluster_total = df["cluster_amount_ratio"] * (df["vendor_mean"] + 1.0)
        flag(
            (df["invoice_amount"] < APPROVAL_THRESHOLD) &
            (cluster_total > APPROVAL_THRESHOLD) &
            (df["window_invoice_count"] >= 2),
            "Threshold Avoidance",
        )

    # ── Benchmark ─────────────────────────────────────────────────────────────
    if "price_flag" in df.columns:
        flag(df["price_flag"] == "OVERPRICED",  "Overpriced vs Benchmark")
        flag(df["price_flag"] == "UNDERPRICED", "Suspiciously Low Price")

    # ── Behavioral ────────────────────────────────────────────────────────────
    if "rounded_amount_flag"    in df.columns: flag(df["rounded_amount_flag"]    == 1, "Rounded Amount")
    if "payment_before_invoice" in df.columns: flag(df["payment_before_invoice"] == 1, "Payment Before Invoice")
    if "weekend_invoice"        in df.columns: flag(df["weekend_invoice"]        == 1, "Weekend Invoice")
    if "rapid_resubmission"     in df.columns: flag(df["rapid_resubmission"]     == 1, "Rapid Resubmission")
    if "invoice_burst"          in df.columns: flag(df["invoice_burst"]          == 1, "Invoice Burst")

    # ── Identity / vendor ─────────────────────────────────────────────────────
    if "unknown_vendor"        in df.columns: flag(df["unknown_vendor"]        == 1, "Unknown Vendor")
    if "bank_account_mismatch" in df.columns: flag(df["bank_account_mismatch"] == 1, "Bank Account Mismatch")
    if "shared_bank_flag"      in df.columns: flag(df["shared_bank_flag"]      == 1, "Shared Bank Account")
    if "shared_gst_flag"       in df.columns: flag(df["shared_gst_flag"]       == 1, "Shared GST")
    if "shell_vendor_flag"     in df.columns: flag(df["shell_vendor_flag"]     == 1, "Shell Vendor")

    # ── Graph / network ───────────────────────────────────────────────────────
    if "co_occurrence_score" in df.columns:
        flag(df["co_occurrence_score"] >= CO_OCCURRENCE_HIGH, "Coordinated Activity")

    if "vendor_degree" in df.columns:
        shared = (
            df.get("shared_bank_flag",    pd.Series(0, index=df.index)).fillna(0) |
            df.get("shared_gst_flag",     pd.Series(0, index=df.index)).fillna(0) |
            df.get("shared_address_flag", pd.Series(0, index=df.index)).fillna(0)
        ).astype(bool)
        flag(
            (df["vendor_degree"] >= GRAPH_HIGH_DEGREE) & shared,
            "Vendor Collusion",
        )

    # ── Data quality ──────────────────────────────────────────────────────────
    if "data_confidence" in df.columns:
        flag(df["data_confidence"] < 0.35, "Low Data Confidence")

    # ── Cap score ─────────────────────────────────────────────────────────────
    df["rule_score"] = df["rule_score"].clip(0, MAX_RULE_SCORE)

    # ── Critical combination detection (vectorized) ───────────────────────────
    def _has_critical(flags_str: str) -> bool:
        active = frozenset(f.strip() for f in flags_str.split(",") if f.strip())
        return any(combo.issubset(active) for combo in CRITICAL_COMBINATIONS)

    df["force_escalate"] = df["rule_flags"].apply(_has_critical)

    # ── Clean flags string ────────────────────────────────────────────────────
    df["rule_flags"] = (
        df["rule_flags"]
        .str.strip(", ")
        .pipe(lambda s: s.where(s.str.strip() != "", other="None"))
    )

    # ── Fraud type (priority-ordered, vectorized) ─────────────────────────────
    df["fraud_type"] = "Normal"
    for flag_name, fraud_label in reversed(_FRAUD_PRIORITY):
        mask = df["rule_flags"].str.contains(flag_name, regex=False, na=False)
        df.loc[mask, "fraud_type"] = fraud_label

    # ML-only anomaly fallback (set later in predict.py if still "Normal")
    return df
