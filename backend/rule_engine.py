"""
rule_engine.py
--------------
Deterministic fraud rule engine.

All thresholds are imported from config.py — no magic numbers here.
co_occurrence_score is on 0-100 scale (produced by graph_engine.py).
rule_score output is 0-100, capped.
force_escalate = True triggers BLOCK in predict.py when score >= 50.
"""

import pandas as pd
from config import (
    APPROVAL_THRESHOLD,
    OVERBILLING_RATIO,
    QUANTITY_MISMATCH_RATIO,
    OVERPAYMENT_RATIO,
    UNDERBILLING_RATIO,
    HIGH_DEVIATION_IQR,
    EXTREME_DEVIATION_IQR,
    RAPID_RESUBMISSION_DAYS,
    INVOICE_BURST_COUNT,
    CO_OCCURRENCE_HIGH,
    FIRST_INVOICE_MULTIPLIER,
    GRAPH_HIGH_DEGREE,
    GRAPH_SHELL_CLUSTER_SIZE,
    SPLIT_CLUSTER_RATIO,
    SPLIT_MIN_INVOICES,
    THRESHOLD_HUG_LOW,
    THRESHOLD_HUG_HIGH,
)

# CO_OCCURRENCE_HIGH in config is 0.70 (old 0-1 scale).
# graph_engine now outputs 0-100, so convert threshold once here.
_CO_OCC_THRESHOLD = CO_OCCURRENCE_HIGH * 100  # = 70.0

RULE_WEIGHTS = {
    # Network / identity fraud — highest weights
    "Shell Vendor Cluster":          40,
    "Shared Bank Account":           32,
    "Invoice Splitting Ring":        35,
    "Vendor Collusion Pattern":      30,
    "Threshold Avoidance":           28,
    "Abnormal Vendor Connectivity":  22,
    "High Risk Vendor Cluster":      30,
    "Circular Payment Pattern":      28,
    # Financial anomalies
    "Overbilling":                   25,
    "Extreme Deviation":             22,
    "Overpayment":                   20,
    "Duplicate Invoice":             32,
    "Missing PO":                    18,
    "Quantity Mismatch":             18,
    "High Deviation":                14,
    "Underbilling":                  12,
    "Overpriced vs Benchmark":       20,
    "Suspiciously Low Price":        12,
    "First Invoice High Value":      18,
    # Behavioral
    "Rapid Sequential Invoices":     12,
    "Repeated Coordinated Timing":   16,
    "Invoice Burst":                 14,
    "Weekend Invoice":                8,
    "Rounded Amount":                 8,
    "Payment Before Invoice":        18,
    # Data quality (informational only)
    "Low Data Confidence":            0,
}

CRITICAL_COMBINATIONS = [
    {"Shell Vendor Cluster",    "Shared Bank Account"},
    {"Invoice Splitting Ring",  "Threshold Avoidance"},
    {"Vendor Collusion Pattern","Repeated Coordinated Timing"},
    {"Circular Payment Pattern","Shell Vendor Cluster"},
    {"Duplicate Invoice",       "Overbilling"},
    {"Shell Vendor Cluster",    "Invoice Splitting Ring"},
    {"Shared Bank Account",     "Extreme Deviation"},
]


def _flag(df: pd.DataFrame, mask: pd.Series, label: str) -> None:
    """Apply a rule flag in-place. mask must be boolean Series."""
    mask = mask.fillna(False).astype(bool)
    weight = RULE_WEIGHTS.get(label, 5)
    df.loc[mask, "rule_score"]  += weight
    df.loc[mask, "rule_flags"]  += label + ", "


def apply_rules(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["rule_score"]     = 0.0
    df["rule_flags"]     = ""
    df["force_escalate"] = False

    # ── Network / identity rules ──────────────────────────────────────────────

    # Shell vendor: shared identifier(s) + meaningful graph cluster
    if "shell_vendor_flag" in df.columns and "vendor_degree" in df.columns:
        _flag(df,
              (df["shell_vendor_flag"] == 1) &
              (df["vendor_degree"] >= GRAPH_HIGH_DEGREE) &
              (df["cluster_size"].fillna(1) >= GRAPH_SHELL_CLUSTER_SIZE),
              "Shell Vendor Cluster")

    # Shared bank account (standalone signal — lower threshold)
    if "shared_bank_flag" in df.columns:
        _flag(df, df["shared_bank_flag"] == 1, "Shared Bank Account")

    # Invoice splitting ring
    if "split_cluster_flag" in df.columns and "window_invoice_count" in df.columns:
        _flag(df,
              (df["split_cluster_flag"] == 1) &
              (df["window_invoice_count"] >= SPLIT_MIN_INVOICES) &
              (df["cluster_amount_ratio"].fillna(0) > SPLIT_CLUSTER_RATIO),
              "Invoice Splitting Ring")

    # Vendor collusion: high co-occurrence + low entropy (coordinated, repetitive)
    if "co_occurrence_score" in df.columns and "entropy_score" in df.columns:
        _flag(df,
              (df["co_occurrence_score"] >= _CO_OCC_THRESHOLD) &
              (df["entropy_score"] < 1.8),
              "Vendor Collusion Pattern")

    # Abnormal connectivity
    if "vendor_degree" in df.columns:
        _flag(df, df["vendor_degree"] >= GRAPH_HIGH_DEGREE + 1, "Abnormal Vendor Connectivity")

    # High-risk cluster
    if "cluster_size" in df.columns and "co_occurrence_score" in df.columns:
        _flag(df,
              (df["cluster_size"] >= 5) &
              (df["co_occurrence_score"] >= _CO_OCC_THRESHOLD),
              "High Risk Vendor Cluster")

    # Coordinated timing: many vendors active same day + high co-occurrence
    if "window_vendor_count" in df.columns and "co_occurrence_score" in df.columns:
        _flag(df,
              (df["window_vendor_count"] >= 5) &
              (df["co_occurrence_score"] >= _CO_OCC_THRESHOLD * 0.8),
              "Repeated Coordinated Timing")

    # Circular payment (optional column)
    if "circular_transaction_flag" in df.columns:
        _flag(df, df["circular_transaction_flag"] == 1, "Circular Payment Pattern")

    # ── Threshold avoidance ───────────────────────────────────────────────────
    if "window_invoice_count" in df.columns and "invoice_amount" in df.columns:
        thr = df["approval_threshold"] if "approval_threshold" in df.columns else APPROVAL_THRESHOLD
        ratio = df["invoice_amount"] / (pd.Series(thr, index=df.index) if not isinstance(thr, pd.Series) else thr).replace(0, pd.NA)
        _flag(df,
              (df["window_invoice_count"] >= SPLIT_MIN_INVOICES) &
              (df["cluster_amount_ratio"].fillna(0) > 1.2) &
              ratio.between(THRESHOLD_HUG_LOW, THRESHOLD_HUG_HIGH, inclusive="both"),
              "Threshold Avoidance")

    # ── Financial rules ───────────────────────────────────────────────────────

    if "amount_vs_po" in df.columns:
        _flag(df, df["amount_vs_po"] > OVERBILLING_RATIO, "Overbilling")

    if "quantity_vs_po" in df.columns:
        _flag(df, df["quantity_vs_po"] > QUANTITY_MISMATCH_RATIO, "Quantity Mismatch")

    if "missing_po" in df.columns:
        _flag(df, df["missing_po"] == 1, "Missing PO")

    if "is_duplicate" in df.columns:
        _flag(df, df["is_duplicate"] == 1, "Duplicate Invoice")

    # High Deviation and Extreme Deviation are mutually exclusive
    if "amount_deviation" in df.columns and "extreme_deviation" in df.columns:
        _flag(df,
              (df["amount_deviation"] > HIGH_DEVIATION_IQR) & (df["extreme_deviation"] != 1),
              "High Deviation")
        _flag(df, df["extreme_deviation"] == 1, "Extreme Deviation")
    elif "amount_deviation" in df.columns:
        _flag(df,
              (df["amount_deviation"] > HIGH_DEVIATION_IQR) & (df["amount_deviation"] <= EXTREME_DEVIATION_IQR),
              "High Deviation")
        _flag(df, df["amount_deviation"] > EXTREME_DEVIATION_IQR, "Extreme Deviation")

    if "payment_ratio" in df.columns:
        _flag(df, df["payment_ratio"] > OVERPAYMENT_RATIO, "Overpayment")

    if "underbilling_flag" in df.columns:
        _flag(df, df["underbilling_flag"] == 1, "Underbilling")

    if "price_flag" in df.columns:
        _flag(df, df["price_flag"] == "OVERPRICED",  "Overpriced vs Benchmark")
        _flag(df, df["price_flag"] == "UNDERPRICED", "Suspiciously Low Price")

    # First invoice high value
    if "vendor_invoice_count" in df.columns and "invoice_amount" in df.columns:
        dataset_median = df["invoice_amount"].median()
        _flag(df,
              (df["vendor_invoice_count"] == 1) &
              (df["invoice_amount"] > FIRST_INVOICE_MULTIPLIER * dataset_median),
              "First Invoice High Value")

    # ── Behavioral rules ──────────────────────────────────────────────────────

    # FIX: was (>= 0 AND <= 1) which catches ALL invoices on first submission.
    # Correct: gap must be > 0 (not the first invoice) AND <= threshold.
    if "invoice_gap_days" in df.columns:
        _flag(df,
              (df["invoice_gap_days"] > 0) & (df["invoice_gap_days"] <= RAPID_RESUBMISSION_DAYS),
              "Rapid Sequential Invoices")

    if "invoice_burst" in df.columns:
        _flag(df, df["invoice_burst"] == 1, "Invoice Burst")

    if "weekend_invoice" in df.columns:
        _flag(df, df["weekend_invoice"] == 1, "Weekend Invoice")

    if "rounded_amount_flag" in df.columns:
        _flag(df, df["rounded_amount_flag"] == 1, "Rounded Amount")

    if "payment_before_invoice" in df.columns:
        _flag(df, df["payment_before_invoice"] == 1, "Payment Before Invoice")

    # ── Data quality (informational, zero weight) ─────────────────────────────
    if "data_confidence" in df.columns:
        _flag(df, df["data_confidence"] < 0.35, "Low Data Confidence")

    # ── Cap and clean ─────────────────────────────────────────────────────────
    df["rule_score"] = df["rule_score"].clip(0, 100)

    df["rule_flags"] = (
        df["rule_flags"]
        .str.strip(", ")
        .pipe(lambda s: s.where(s.str.strip() != "", other="None"))
    )

    # ── Critical combination detection → force_escalate ───────────────────────
    def _check_combos(flags_str: str) -> bool:
        active = {f.strip() for f in flags_str.split(",") if f.strip() and f.strip() != "None"}
        return any(combo.issubset(active) for combo in CRITICAL_COMBINATIONS)

    df["force_escalate"] = df["rule_flags"].apply(_check_combos)

    return df
