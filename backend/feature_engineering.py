"""
feature_engineering.py
-----------------------
Produces the exact 18 ML features defined in config.ML_FEATURES,
plus all auxiliary columns needed by rule_engine.py and predict.py.

Feature order MUST match the training pipeline exactly.
All features are numeric, NaN-free, and clipped to safe ranges.
"""

import pandas as pd
import numpy as np
from canonical_schema import compute_confidence
from config import (
    ML_FEATURES,
    SPLIT_CLUSTER_RATIO,
    SPLIT_MIN_INVOICES,
    APPROVAL_THRESHOLD,
)
from graph_engine import enrich_with_graph_features

# Backward-compat alias
FEATURE_COLUMNS = ML_FEATURES


def _safe_div(num: pd.Series, den: pd.Series, fill: float = 0.0) -> pd.Series:
    with np.errstate(divide="ignore", invalid="ignore"):
        result = np.where(den != 0, num / den, fill)
    return pd.Series(result, index=num.index).fillna(fill)


def compute_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    present_cols       = df.attrs.get("present_cols", set())
    po_col_was_present = "approved_amount_po" in present_cols
    paid_col_present   = "paid_amount" in present_cols

    # ── Vendor ID ─────────────────────────────────────────────────────────────
    if "vendor_id" not in df.columns or df["vendor_id"].isna().all():
        df["vendor_id"] = df.get("vendor_name", pd.Series(["unknown"] * len(df))).fillna("unknown")
    df["vendor_id"] = df["vendor_id"].fillna("unknown").astype(str)

    # ── Numeric safety ────────────────────────────────────────────────────────
    for col in ["invoice_amount", "approved_amount_po", "quantity",
                "approved_quantity_po", "paid_amount", "unit_price"]:
        if col not in df.columns:
            df[col] = 0.0
        else:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)

    # ── Date safety ───────────────────────────────────────────────────────────
    if "invoice_date" not in df.columns:
        df["invoice_date"] = pd.NaT
    else:
        df["invoice_date"] = pd.to_datetime(df["invoice_date"], errors="coerce")

    # ── Global fallbacks ──────────────────────────────────────────────────────
    global_mean = float(df["invoice_amount"].mean()) if len(df) > 0 else 1.0
    global_std  = float(df["invoice_amount"].std())  if len(df) > 1 else 1.0
    global_mean = max(global_mean, 1.0)
    global_std  = max(global_std,  1.0)

    # ── Vendor stats ──────────────────────────────────────────────────────────
    grp     = df.groupby("vendor_id")["invoice_amount"]
    v_mean  = grp.mean().to_dict()
    v_std   = grp.std().fillna(0).to_dict()
    v_count = grp.count().to_dict()

    df["vendor_mean"]          = df["vendor_id"].map(v_mean).fillna(global_mean)
    df["vendor_std"]           = df["vendor_id"].map(v_std).fillna(global_std)
    df["vendor_invoice_count"] = df["vendor_id"].map(v_count).fillna(1.0)

    # ── Feature 1: amount ─────────────────────────────────────────────────────
    df["amount"] = df["invoice_amount"]

    # ── Feature 4: amount_zscore ──────────────────────────────────────────────
    df["amount_zscore"] = (
        (df["invoice_amount"] - df["vendor_mean"]) / (df["vendor_std"] + 1e-6)
    ).clip(-10, 10).fillna(0.0)

    # ── Feature 5: amount_ratio ───────────────────────────────────────────────
    df["amount_ratio"] = (
        df["invoice_amount"] / (df["vendor_mean"] + 1.0)
    ).clip(0, 20).fillna(1.0)

    # ── Feature 6: invoice_gap_days ───────────────────────────────────────────
    df = df.sort_values(["vendor_id", "invoice_date"]).copy()
    df["invoice_gap_days"] = (
        df.groupby("vendor_id")["invoice_date"]
        .diff().dt.days.fillna(0.0)
    )

    # ── Feature 7: vendor_frequency ──────────────────────────────────────────
    df["vendor_frequency"] = df["vendor_invoice_count"]

    # ── Date helper columns ───────────────────────────────────────────────────
    df["_d"] = df["invoice_date"].dt.date

    # ── Feature 11: window_invoice_count ─────────────────────────────────────
    df["window_invoice_count"] = (
        df.groupby(["vendor_id", "_d"])["invoice_amount"]
        .transform("count")
        .fillna(1)
    )

    # ── Feature 12: window_vendor_count ──────────────────────────────────────
    df["window_vendor_count"] = (
        df.groupby("_d")["vendor_id"]
        .transform("nunique")
        .fillna(1)
    )

    # ── Feature 13: cluster_amount_ratio ─────────────────────────────────────
    # Sum of all invoices from same vendor on same day / vendor mean
    daily_total = (
        df.groupby(["vendor_id", "_d"])["invoice_amount"]
        .transform("sum")
    )
    df["cluster_amount_ratio"] = (
        daily_total / (df["vendor_mean"] + 1.0)
    ).clip(0, 20).fillna(1.0)

    # ── Feature 8: split_cluster_flag ────────────────────────────────────────
    # Fires when vendor submits multiple invoices in a day AND cluster total
    # exceeds the vendor's typical amount by SPLIT_CLUSTER_RATIO
    df["split_cluster_flag"] = (
        (df["window_invoice_count"] >= SPLIT_MIN_INVOICES) &
        (df["cluster_amount_ratio"] > SPLIT_CLUSTER_RATIO)
    ).astype(int)

    # ── Feature 9: vendor_degree (pre-graph placeholder, overwritten below) ──
    df["vendor_degree"] = (
        df.groupby("_d")["vendor_id"]
        .transform("nunique")
        .fillna(1)
    )

    # ── Feature 10: cluster_size ─────────────────────────────────────────────
    df["cluster_size"] = (
        df.groupby(["vendor_id", "_d"])["invoice_amount"]
        .transform("count")
        .fillna(1)
    )

    # co_occurrence_score is computed on 0-100 scale by graph_engine.py
    # Set a placeholder here; graph_engine will overwrite it.
    df["co_occurrence_score"] = 0.0

    df = df.drop(columns=["_d"])

    # ── Feature 15: entropy_score ─────────────────────────────────────────────
    def _entropy(amounts: pd.Series) -> float:
        if len(amounts) <= 1:
            return 0.0
        total = float(amounts.sum())
        if total == 0:
            return 0.0
        probs = amounts / total
        probs = probs[probs > 0]
        return float(-np.sum(probs * np.log2(probs + 1e-10)))

    entropy_map = df.groupby("vendor_id")["invoice_amount"].apply(_entropy).to_dict()
    df["entropy_score"] = df["vendor_id"].map(entropy_map).fillna(0.0)

    # ── Graph enrichment (features 9, 10, 16, 17, 18) ────────────────────────
    # enrich_with_graph_features overwrites vendor_degree, cluster_size
    # and adds shared_bank_flag, shared_gst_flag, shared_address_flag
    df = enrich_with_graph_features(df)

    # Ensure graph-derived ML features exist and are numeric
    for col in ["shared_bank_flag", "shared_gst_flag", "shared_address_flag",
                "vendor_degree", "cluster_size", "pagerank", "betweenness_centrality",
                "shell_vendor_flag"]:
        if col not in df.columns:
            df[col] = 0
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    # ── Cluster ID (informational) ────────────────────────────────────────────
    df["_d2"] = df["invoice_date"].dt.date
    df["cluster_id"] = df.apply(
        lambda r: f"cluster_{abs(hash(str(r['vendor_id']) + str(r['_d2']))) % 10000}"
        if r["split_cluster_flag"] == 1 else None,
        axis=1,
    )
    df = df.drop(columns=["_d2"])

    # ── Guarantee ALL 18 ML features are numeric and present ─────────────────
    for feat in ML_FEATURES:
        if feat not in df.columns:
            df[feat] = 0.0
        df[feat] = pd.to_numeric(df[feat], errors="coerce").fillna(0.0)

    # ── Auxiliary features for rule_engine ────────────────────────────────────
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
    df["missing_po"] = (
        (df["invoice_amount"] > 0) & (~po_present)
    ).astype(int) if po_col_was_present else 0

    df["_d3"] = df["invoice_date"].dt.date
    df["duplicate_pattern"] = df.duplicated(
        subset=["vendor_id", "invoice_amount", "_d3"], keep=False
    ).astype(int)
    df["is_duplicate"] = df["duplicate_pattern"]
    df = df.drop(columns=["_d3"])

    df["payment_ratio"] = np.where(
        df["invoice_amount"] > 0,
        _safe_div(df["paid_amount"], df["invoice_amount"], fill=0.0),
        0.0,
    )

    df["weekend_invoice"] = df["invoice_date"].apply(
        lambda d: 1 if pd.notna(d) and d.weekday() >= 5 else 0
    )

    df["rapid_resubmission"] = (
        (df["invoice_gap_days"] > 0) & (df["invoice_gap_days"] <= 2)
    ).astype(int)

    df["_d4"] = df["invoice_date"].dt.date
    df["invoice_burst"] = (
        df.groupby(["vendor_id", "_d4"])["invoice_amount"]
        .transform("count") >= 4
    ).astype(int)
    df = df.drop(columns=["_d4"])

    df["rounded_amount_flag"] = (
        (df["invoice_amount"] > 10000) & (df["invoice_amount"] % 1000 == 0)
    ).astype(int)

    if paid_col_present:
        today = pd.Timestamp.now().normalize()
        df["payment_before_invoice"] = (
            (df["paid_amount"] > 0) & (df["invoice_date"] > today)
        ).astype(int)
    else:
        df["payment_before_invoice"] = 0

    global_q75 = float(df["invoice_amount"].quantile(0.75)) if len(df) > 0 else global_mean
    global_q25 = float(df["invoice_amount"].quantile(0.25)) if len(df) > 0 else 0.0
    global_iqr = max(global_q75 - global_q25, 1.0)

    df["amount_deviation"] = (
        (df["invoice_amount"] - df["vendor_mean"]).abs() / (global_iqr + 1.0)
    ).clip(0, 10).fillna(0.0)
    df["extreme_deviation"] = (df["amount_deviation"] > 5.0).astype(int)
    df["overpayment_flag"]  = (df["payment_ratio"] > 1.15).astype(int)
    df["underbilling_flag"] = (po_present & (df["amount_vs_po"] < 0.4)).astype(int)
    df["high_amount_flag"]  = (df["invoice_amount"] > df["vendor_mean"] * 3.0).astype(int)

    # Approval threshold column for rule_engine threshold-hugging rule
    df["approval_threshold"] = APPROVAL_THRESHOLD

    if "unknown_vendor" not in df.columns:
        df["unknown_vendor"] = 0

    # ── Behavior score ────────────────────────────────────────────────────────
    behavior = (
        df["weekend_invoice"]        * 8  +
        df["rapid_resubmission"]     * 12 +
        df["invoice_burst"]          * 15 +
        df["rounded_amount_flag"]    * 10 +
        df["payment_before_invoice"] * 20 +
        df["split_cluster_flag"]     * 20 +
        df["shared_bank_flag"]       * 15 +
        df["shell_vendor_flag"]      * 20
    )
    df["behavior_score"] = behavior.clip(0, 100).astype(float)

    df["data_confidence"] = df.apply(
        lambda row: compute_confidence(row.to_dict(), po_col_was_present=po_col_was_present),
        axis=1,
    )

    return df
