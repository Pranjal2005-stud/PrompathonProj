"""
rule_engine.py
--------------
Enterprise-grade deterministic fraud rule engine.

Design:
- Every rule has a weight reflecting its fraud signal strength
- Rules are grouped by category (financial, behavioral, identity, data quality)
- rule_score is a 0–100 weighted sum used by predict.py
- No rule alone makes a final decision — they contribute evidence
- Thresholds calibrated for enterprise procurement (HVAC/construction/manufacturing)

Expected outputs on clean dataset:   rule_score mostly 0–25
Expected outputs on fraud dataset:   rule_score 30–100 depending on fraud type
"""

import pandas as pd

# ── Rule weight registry ──────────────────────────────────────────────────────
# Weights represent how strongly each flag indicates fraud (0–35 scale per rule)
# Multiple flags accumulate — total is capped at 100

RULE_WEIGHTS = {
    # ── Financial fraud signals ───────────────────────────────────────────────
    "Duplicate Invoice":         35,   # strongest signal — clear fraud
    "Overbilling":               28,   # invoice > 140% of PO
    "Extreme Deviation":         25,   # amount > 5x IQR from vendor median
    "Overpriced vs Benchmark":   25,   # exceeds market price benchmark
    "Overpayment":               22,   # paid > 115% of invoice
    "Quantity Mismatch":         20,   # delivered > 160% of approved qty
    "High Deviation":            15,   # amount > 2.0x IQR from vendor median
    "Suspiciously Low Price":    15,   # below market benchmark (possible kickback)
    "Split Invoice Pattern":     25,   # threshold-avoidance splitting

    # ── Identity / vendor signals ─────────────────────────────────────────────
    "Unknown Vendor":            20,   # vendor not in master list
    "Bank Account Mismatch":     30,   # payment account differs from registered

    # ── Behavioral / timing signals ───────────────────────────────────────────
    "Rapid Resubmission":        12,   # same vendor within 2 days
    "Weekend Invoice":            8,   # submitted on Saturday/Sunday
    "Invoice Burst":             15,   # 4+ invoices same vendor same day
    "Rounded Amount":            10,   # suspiciously round number
    "Payment Before Invoice":    20,   # paid before invoice date

    # ── PO / process signals ──────────────────────────────────────────────────
    "Missing PO":                12,   # PO column present but value absent
    "Underbilling":               8,   # invoice < 40% of PO (possible kickback setup)

    # ── Data quality signals (informational only) ─────────────────────────────
    "Low Data Confidence":        0,   # no score impact — just informational
}

# ── Critical fraud combinations that force escalation ────────────────────────
# If ALL flags in a combination are present, the invoice is auto-escalated
CRITICAL_COMBINATIONS = [
    {"Duplicate Invoice", "Overpayment"},
    {"Overbilling", "Split Invoice Pattern"},
    {"Unknown Vendor", "Bank Account Mismatch"},
    {"Extreme Deviation", "Weekend Invoice"},
    {"Duplicate Invoice", "Rapid Resubmission"},
]


def apply_rules(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["rule_flags"]        = ""
    df["rule_score"]        = 0.0
    df["force_escalate"]    = False   # set True when critical combination detected

    def flag(condition: pd.Series, label: str):
        mask = condition.fillna(False).astype(bool)
        df.loc[mask, "rule_flags"] += label + ", "
        df.loc[mask, "rule_score"] += RULE_WEIGHTS.get(label, 5)

    # ── Financial rules ───────────────────────────────────────────────────────

    # Overbilling: invoice > 140% of approved PO amount
    if "amount_vs_po" in df.columns:
        flag(df["amount_vs_po"] > 1.4, "Overbilling")

    # Quantity mismatch: delivered > 160% of approved quantity
    if "quantity_vs_po" in df.columns:
        flag(df["quantity_vs_po"] > 1.6, "Quantity Mismatch")

    # Missing PO (only fires when PO column was in upload — see feature_engineering)
    if "missing_po" in df.columns:
        flag(df["missing_po"] == 1, "Missing PO")

    # Duplicate invoice
    if "is_duplicate" in df.columns:
        flag(df["is_duplicate"] == 1, "Duplicate Invoice")

    # High deviation: IQR-score > 2.0
    if "amount_deviation" in df.columns:
        flag(df["amount_deviation"] > 2.0, "High Deviation")

    # Extreme deviation: IQR-score > 5.0
    if "extreme_deviation" in df.columns:
        flag(df["extreme_deviation"] == 1, "Extreme Deviation")

    # Overpayment: paid > 115% of invoice
    if "payment_ratio" in df.columns:
        flag(df["payment_ratio"] > 1.15, "Overpayment")

    # Underbilling: invoice < 40% of PO (possible kickback setup)
    if "underbilling_flag" in df.columns:
        flag(df["underbilling_flag"] == 1, "Underbilling")

    # ── Benchmark rules ───────────────────────────────────────────────────────
    if "price_flag" in df.columns:
        flag(df["price_flag"] == "OVERPRICED",  "Overpriced vs Benchmark")
        flag(df["price_flag"] == "UNDERPRICED", "Suspiciously Low Price")

    # ── Pattern rules ─────────────────────────────────────────────────────────
    if "split_invoice_flag" in df.columns:
        flag(df["split_invoice_flag"] == 1, "Split Invoice Pattern")

    if "rounded_amount_flag" in df.columns:
        flag(df["rounded_amount_flag"] == 1, "Rounded Amount")

    if "payment_before_invoice" in df.columns:
        flag(df["payment_before_invoice"] == 1, "Payment Before Invoice")

    # ── Behavioral / timing rules ─────────────────────────────────────────────
    if "weekend_invoice" in df.columns:
        flag(df["weekend_invoice"] == 1, "Weekend Invoice")

    if "rapid_resubmission" in df.columns:
        flag(df["rapid_resubmission"] == 1, "Rapid Resubmission")

    if "invoice_burst" in df.columns:
        flag(df["invoice_burst"] == 1, "Invoice Burst")

    # ── Identity rules ────────────────────────────────────────────────────────
    if "unknown_vendor" in df.columns:
        flag(df["unknown_vendor"] == 1, "Unknown Vendor")

    if "bank_account_mismatch" in df.columns:
        flag(df["bank_account_mismatch"] == 1, "Bank Account Mismatch")

    # ── Data quality (informational) ──────────────────────────────────────────
    if "data_confidence" in df.columns:
        flag(df["data_confidence"] < 0.35, "Low Data Confidence")

    # ── Cap rule_score at 100 ─────────────────────────────────────────────────
    df["rule_score"] = df["rule_score"].clip(0, 100)

    # ── Critical combination detection ───────────────────────────────────────
    # Check each row's active flags against critical combinations
    def _check_combinations(flags_str: str) -> bool:
        active = set(f.strip() for f in flags_str.split(",") if f.strip())
        for combo in CRITICAL_COMBINATIONS:
            if combo.issubset(active):
                return True
        return False

    df["force_escalate"] = df["rule_flags"].apply(_check_combinations)

    # Clean up rule_flags string
    df["rule_flags"] = df["rule_flags"].str.strip(", ").replace("", "None")

    return df
