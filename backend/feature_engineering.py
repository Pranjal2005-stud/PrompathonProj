"""
feature_engineering.py
-----------------------
Enterprise-grade feature computation for procurement fraud detection.

Features computed:
  - Vendor behavioral statistics (IQR-based, sparse-vendor safe)
  - PO-aware missing data handling
  - Duplicate and split invoice detection
  - Weekend / rapid resubmission timing patterns
  - Rounded amount detection (common in fabricated invoices)
  - Payment-before-invoice detection
  - Unknown vendor flag
  - Behavioral burst detection (vendor invoice frequency spike)
  - Data confidence scoring
"""

import pandas as pd
import numpy as np
from canonical_schema import compute_confidence


def _safe_div(num: pd.Series, den: pd.Series, fill: float = 0.0) -> pd.Series:
    return (num / den.replace(0, np.nan)).fillna(fill)


def compute_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    # ── Retrieve upload metadata ──────────────────────────────────────────────
    present_cols       = df.attrs.get("present_cols", set())
    po_col_was_present = "approved_amount_po" in present_cols
    paid_col_present   = "paid_amount" in present_cols

    # ── 1. Vendor ID safety ───────────────────────────────────────────────────
    if "vendor_id" not in df.columns or df["vendor_id"].isna().all():
        df["vendor_id"] = df.get(
            "vendor_name", pd.Series(["unknown"] * len(df))
        ).fillna("unknown")
    df["vendor_id"] = df["vendor_id"].fillna("unknown").astype(str)

    # ── 2. Numeric column safety ──────────────────────────────────────────────
    for col in ["invoice_amount", "approved_amount_po", "quantity",
                "approved_quantity_po", "paid_amount", "unit_price"]:
        if col not in df.columns:
            df[col] = 0.0
        else:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)

    # ── 3. Date safety ────────────────────────────────────────────────────────
    if "invoice_date" not in df.columns:
        df["invoice_date"] = pd.NaT
    else:
        df["invoice_date"] = pd.to_datetime(df["invoice_date"], errors="coerce")

    # ── 4. Global statistics (used as fallback for sparse vendors) ────────────
    global_mean   = float(df["invoice_amount"].mean()   or 1.0)
    global_median = float(df["invoice_amount"].median() or 1.0)
    global_q75    = float(df["invoice_amount"].quantile(0.75) or global_mean)
    global_q25    = float(df["invoice_amount"].quantile(0.25) or 0.0)
    global_iqr    = max(global_q75 - global_q25, 1.0)
    global_std    = float(df["invoice_amount"].std() or global_iqr)

    # ── 5. Vendor-level statistics ────────────────────────────────────────────
    def _vendor_iqr(x):
        return x.quantile(0.75) - x.quantile(0.25)

    vendor_stats = (
        df.groupby("vendor_id")["invoice_amount"]
        .agg(["mean", "median", "std", "count", _vendor_iqr])
        .rename(columns={
            "mean":       "vendor_avg_amount",
            "median":     "vendor_median_amount",
            "std":        "vendor_std_amount",
            "count":      "vendor_invoice_count",
            "_vendor_iqr":"vendor_iqr",
        })
    )
    vendor_stats["vendor_std_amount"] = vendor_stats["vendor_std_amount"].fillna(0.0)
    vendor_stats["vendor_iqr"]        = vendor_stats["vendor_iqr"].fillna(0.0)
    df = df.merge(vendor_stats, on="vendor_id", how="left")

    df["vendor_avg_amount"]    = df["vendor_avg_amount"].fillna(global_mean)
    df["vendor_median_amount"] = df["vendor_median_amount"].fillna(global_median)
    df["vendor_std_amount"]    = df["vendor_std_amount"].fillna(global_std)
    df["vendor_invoice_count"] = df["vendor_invoice_count"].fillna(1.0)
    df["vendor_iqr"]           = df["vendor_iqr"].fillna(global_iqr)

    # ── 6. Amount deviation — IQR-based ──────────────────────────────────────
    # Vendors with ≥3 invoices use their own IQR.
    # Sparse/new vendors use global IQR so they aren't trivially anomalous.
    has_vendor_iqr = (df["vendor_invoice_count"] >= 3) & (df["vendor_iqr"] > 0)
    effective_iqr  = np.where(has_vendor_iqr, df["vendor_iqr"], global_iqr)

    df["amount_deviation"] = (
        (df["invoice_amount"] - df["vendor_median_amount"]).abs()
        / (effective_iqr + 1.0)
    ).clip(0, 10).fillna(0.0)

    # ── 7. PO-based features ──────────────────────────────────────────────────
    po_present = df["approved_amount_po"] > 0

    df["amount_vs_po"] = np.where(
        po_present,
        _safe_div(df["invoice_amount"], df["approved_amount_po"], fill=1.0),
        1.0,
    )
    df["quantity_vs_po"] = np.where(
        df["approved_quantity_po"] > 0,
        _safe_div(df["quantity"], df["approved_quantity_po"], fill=1.0),
        1.0,
    )

    # missing_po: ONLY when PO column was in the upload schema but value is absent
    if po_col_was_present:
        df["missing_po"] = (
            (df["invoice_amount"] > 0) & (~po_present)
        ).astype(int)
    else:
        df["missing_po"] = 0

    # ── 8. Duplicate detection ────────────────────────────────────────────────
    df["_date_only"] = df["invoice_date"].dt.date
    df["duplicate_pattern"] = df.duplicated(
        subset=["vendor_id", "invoice_amount", "_date_only"], keep=False
    ).astype(int)
    df["is_duplicate"] = df["duplicate_pattern"]
    df = df.drop(columns=["_date_only"])

    # ── 9. Split invoice detection ────────────────────────────────────────────
    # 3+ invoices from same vendor on same day, each below 60% of vendor avg,
    # but combined total exceeds vendor avg — classic threshold-avoidance fraud
    df["_date_only"] = df["invoice_date"].dt.date
    daily_count = df.groupby(["vendor_id", "_date_only"])["invoice_amount"].transform("count")
    daily_total = df.groupby(["vendor_id", "_date_only"])["invoice_amount"].transform("sum")
    df["split_invoice_flag"] = (
        (daily_count >= 3)
        & (df["invoice_amount"] < df["vendor_avg_amount"] * 0.6)
        & (daily_total > df["vendor_avg_amount"])
    ).astype(int)
    df = df.drop(columns=["_date_only"])

    # ── 10. High amount flag ──────────────────────────────────────────────────
    df["high_amount_flag"] = (
        df["invoice_amount"] > df["vendor_avg_amount"] * 3.0
    ).astype(int)

    # ── 11. Payment ratio ─────────────────────────────────────────────────────
    df["payment_ratio"] = np.where(
        df["invoice_amount"] > 0,
        _safe_div(df["paid_amount"], df["invoice_amount"], fill=0.0),
        0.0,
    )

    # ── 12. Days since last invoice ───────────────────────────────────────────
    df = df.sort_values(["vendor_id", "invoice_date"])
    df["days_since_last_invoice"] = (
        df.groupby("vendor_id")["invoice_date"]
        .diff().dt.days.fillna(0.0)
    )

    # ── 13. Weekend invoice ───────────────────────────────────────────────────
    df["weekend_invoice"] = df["invoice_date"].apply(
        lambda d: 1 if pd.notna(d) and d.weekday() >= 5 else 0
    )

    # ── 14. Rapid resubmission ────────────────────────────────────────────────
    # Same vendor submitting again within 2 days
    df["rapid_resubmission"] = (
        (df["days_since_last_invoice"] > 0)
        & (df["days_since_last_invoice"] <= 2)
    ).astype(int)

    # ── 15. Invoice burst detection ───────────────────────────────────────────
    # Vendor submitting significantly more invoices than their historical rate
    # Uses rolling 7-day window count vs vendor average frequency
    df["_date_only"] = df["invoice_date"].dt.date
    weekly_count = df.groupby(["vendor_id", "_date_only"])["invoice_amount"].transform("count")
    # Flag if vendor submits >3 invoices in a single day (burst)
    df["invoice_burst"] = (weekly_count >= 4).astype(int)
    df = df.drop(columns=["_date_only"])

    # ── 16. Rounded amount detection ─────────────────────────────────────────
    # Fabricated invoices often use suspiciously round numbers
    # Flag if amount is divisible by 1000 and > 10000
    df["rounded_amount_flag"] = (
        (df["invoice_amount"] > 10000)
        & (df["invoice_amount"] % 1000 == 0)
    ).astype(int)

    # ── 17. Payment before invoice date ──────────────────────────────────────
    # Only computable if both paid_amount and a payment_date column exist
    # For now, flag if paid_amount > 0 but invoice_date is in the future
    if paid_col_present:
        today = pd.Timestamp.now().normalize()
        df["payment_before_invoice"] = (
            (df["paid_amount"] > 0)
            & (df["invoice_date"] > today)
        ).astype(int)
    else:
        df["payment_before_invoice"] = 0

    # ── 18. Unknown vendor flag ───────────────────────────────────────────────
    # Will be enriched by predict.py after vendor master merge
    # Initialize to 0 here; predict.py sets it after merge
    if "unknown_vendor" not in df.columns:
        df["unknown_vendor"] = 0

    # ── 19. Derived flags ─────────────────────────────────────────────────────
    df["extreme_deviation"] = (df["amount_deviation"] > 5.0).astype(int)
    df["overpayment_flag"]  = (df["payment_ratio"] > 1.15).astype(int)
    df["underbilling_flag"] = (
        po_present & (df["amount_vs_po"] < 0.4)
    ).astype(int)

    # ── 20. Behavioral score (pre-compute for predict.py) ─────────────────────
    # Combines timing and pattern signals into a 0–100 behavioral risk score
    behavior = (
        df["weekend_invoice"]       * 8  +
        df["rapid_resubmission"]    * 12 +
        df["invoice_burst"]         * 15 +
        df["rounded_amount_flag"]   * 10 +
        df["payment_before_invoice"]* 20 +
        df["split_invoice_flag"]    * 20
    )
    df["behavior_score"] = behavior.clip(0, 100).astype(float)

    # ── 21. Data confidence score ─────────────────────────────────────────────
    df["data_confidence"] = df.apply(
        lambda row: compute_confidence(
            row.to_dict(), po_col_was_present=po_col_was_present
        ),
        axis=1,
    )

    return df
