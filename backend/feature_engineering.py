"""
feature_engineering.py
-----------------------
Produces all 18 ML features (config.ML_FEATURES) plus auxiliary columns
for rule_engine.py and predict.py.

All operations are vectorized — zero iterrows().
"""

import logging

import numpy as np
import pandas as pd

from canonical_schema import compute_confidence
from config import (
    ML_FEATURES,
    SPLIT_CLUSTER_RATIO,
    SPLIT_MIN_INVOICES,
    APPROVAL_THRESHOLD,
    MAX_ZSCORE,
    MAX_RATIO,
    INVOICE_BURST_COUNT,
    RAPID_RESUBMISSION_DAYS,
)
from graph_engine import enrich_with_graph_features

log = logging.getLogger(__name__)

FEATURE_COLUMNS = ML_FEATURES   # backward-compat alias


def _safe_div(num: pd.Series, den: pd.Series, fill: float = 0.0) -> pd.Series:
    with np.errstate(divide="ignore", invalid="ignore"):
        out = np.where(den != 0, num / den, fill)
    return pd.Series(out, index=num.index).fillna(fill)


def compute_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    present_cols       = df.attrs.get("present_cols", set())
    po_col_was_present = "approved_amount_po" in present_cols
    paid_col_present   = "paid_amount" in present_cols

    # ── Vendor ID ─────────────────────────────────────────────────────────────
    if "vendor_id" not in df.columns or df["vendor_id"].isna().all():
        df["vendor_id"] = df.get(
            "vendor_name", pd.Series(["unknown"] * len(df))
        ).fillna("unknown")
    df["vendor_id"] = df["vendor_id"].fillna("unknown").astype(str)

    # ── Numeric coercion ──────────────────────────────────────────────────────
    for col in ("invoice_amount", "approved_amount_po",
                "quantity", "approved_quantity_po", "paid_amount", "unit_price"):
        if col not in df.columns:
            df[col] = 0.0
        else:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)

    # ── Date parsing ──────────────────────────────────────────────────────────
    if "invoice_date" not in df.columns:
        df["invoice_date"] = pd.NaT
    else:
        df["invoice_date"] = pd.to_datetime(df["invoice_date"], errors="coerce")

    # ── Global stats ──────────────────────────────────────────────────────────
    amt            = df["invoice_amount"]
    global_mean    = max(float(amt.mean())         if len(df) > 0 else 1.0, 1.0)
    global_std     = max(float(amt.std())          if len(df) > 1 else 1.0, 1.0)
    global_q25     = float(amt.quantile(0.25))     if len(df) > 0 else 0.0
    global_q75     = float(amt.quantile(0.75))     if len(df) > 0 else global_mean
    global_iqr     = max(global_q75 - global_q25, 1.0)
    dataset_median = float(amt.median())           if len(df) > 0 else global_mean

    # ── Vendor stats ──────────────────────────────────────────────────────────
    grp     = df.groupby("vendor_id")["invoice_amount"]
    v_mean  = grp.mean()
    v_std   = grp.std().fillna(0)
    v_count = grp.count()

    df["vendor_mean"]          = df["vendor_id"].map(v_mean).fillna(global_mean)
    df["vendor_std"]           = df["vendor_id"].map(v_std).fillna(global_std)
    df["vendor_invoice_count"] = df["vendor_id"].map(v_count).fillna(1.0)

    # ── amount ────────────────────────────────────────────────────────────────
    df["amount"] = df["invoice_amount"]

    # ── amount_zscore ─────────────────────────────────────────────────────────
    df["amount_zscore"] = (
        (df["invoice_amount"] - df["vendor_mean"]) / (df["vendor_std"] + 1e-6)
    ).clip(-MAX_ZSCORE, MAX_ZSCORE).fillna(0.0)

    # ── amount_ratio ──────────────────────────────────────────────────────────
    df["amount_ratio"] = (
        df["invoice_amount"] / (df["vendor_mean"] + 1.0)
    ).clip(0, MAX_RATIO).fillna(1.0)

    # ── Sort once for all temporal features ───────────────────────────────────
    df = df.sort_values(["vendor_id", "invoice_date"]).reset_index(drop=True)

    # ── invoice_gap_days ──────────────────────────────────────────────────────
    df["invoice_gap_days"] = (
        df.groupby("vendor_id")["invoice_date"]
        .diff().dt.days.fillna(0.0)
    )

    # ── vendor_frequency ──────────────────────────────────────────────────────
    df["vendor_frequency"] = df["vendor_invoice_count"]

    # ── Date key ──────────────────────────────────────────────────────────────
    df["_date"] = df["invoice_date"].dt.date

    # ── window_invoice_count ──────────────────────────────────────────────────
    df["window_invoice_count"] = (
        df.groupby(["vendor_id", "_date"])["invoice_amount"]
        .transform("count")
        .fillna(1)
    )

    # ── window_vendor_count ───────────────────────────────────────────────────
    df["window_vendor_count"] = (
        df.groupby("_date")["vendor_id"]
        .transform("nunique")
        .fillna(1)
    )

    # ── cluster_amount_ratio ──────────────────────────────────────────────────
    daily_sum = (
        df.groupby(["vendor_id", "_date"])["invoice_amount"]
        .transform("sum")
    )
    df["cluster_amount_ratio"] = (
        daily_sum / (df["vendor_mean"] + 1.0)
    ).clip(0, MAX_RATIO).fillna(1.0)

    # ── split_cluster_flag ────────────────────────────────────────────────────
    # Fires when vendor submits >= SPLIT_MIN_INVOICES on same day AND
    # the daily cluster total exceeds vendor mean by SPLIT_CLUSTER_RATIO
    df["split_cluster_flag"] = (
        (df["window_invoice_count"] >= SPLIT_MIN_INVOICES) &
        (df["cluster_amount_ratio"] > SPLIT_CLUSTER_RATIO)
    ).astype(int)

    # ── cluster_size (pre-graph placeholder) ─────────────────────────────────
    df["cluster_size"] = (
        df.groupby(["vendor_id", "_date"])["invoice_amount"]
        .transform("count")
        .fillna(1)
    )

    # ── vendor_degree (pre-graph placeholder) ────────────────────────────────
    df["vendor_degree"] = (
        df.groupby("_date")["vendor_id"]
        .transform("nunique")
        .fillna(1)
    )

    # ── entropy_score ─────────────────────────────────────────────────────────
    def _entropy(amounts: pd.Series) -> float:
        if len(amounts) <= 1:
            return 0.0
        total = float(amounts.sum())
        if total == 0:
            return 0.0
        p = amounts / total
        p = p[p > 0]
        return float(-np.sum(p * np.log2(p + 1e-10)))

    entropy_map = df.groupby("vendor_id")["invoice_amount"].apply(_entropy).to_dict()
    df["entropy_score"] = df["vendor_id"].map(entropy_map).fillna(0.0)

    # ── Graph enrichment ──────────────────────────────────────────────────────
    # Overwrites vendor_degree, cluster_size; adds shared_*_flag, shell_vendor_flag,
    # community_size, pagerank
    df = enrich_with_graph_features(df)

    # community_size is the training-time name for cluster_size
    if "community_size" not in df.columns:
        df["community_size"] = df["cluster_size"].fillna(1.0)

    # pagerank must always be present
    if "pagerank" not in df.columns:
        df["pagerank"] = 0.0

    # ── cluster_id (informational) ────────────────────────────────────────────
    df["cluster_id"] = np.where(
        df["split_cluster_flag"] == 1,
        "cluster_" + (
            df["vendor_id"].astype(str) + df["_date"].astype(str)
        ).apply(lambda s: str(abs(hash(s)) % 10000)),
        None,
    )

    df = df.drop(columns=["_date"])

    # ── Guarantee all 18 ML features exist and are numeric ───────────────────
    for feat in ML_FEATURES:
        if feat not in df.columns:
            df[feat] = 0.0
        df[feat] = (
            pd.to_numeric(df[feat], errors="coerce")
            .replace([np.inf, -np.inf], 0.0)
            .fillna(0.0)
        )

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

    # Duplicate detection
    df["_d_dup"] = df["invoice_date"].dt.date
    df["duplicate_pattern"] = df.duplicated(
        subset=["vendor_id", "invoice_amount", "_d_dup"], keep=False
    ).astype(int)
    df["is_duplicate"] = df["duplicate_pattern"]
    df = df.drop(columns=["_d_dup"])

    df["payment_ratio"] = np.where(
        df["invoice_amount"] > 0,
        _safe_div(df["paid_amount"], df["invoice_amount"], fill=0.0),
        0.0,
    )

    df["weekend_invoice"] = (
        df["invoice_date"].dt.dayofweek >= 5
    ).fillna(False).astype(int)

    df["rapid_resubmission"] = (
        (df["invoice_gap_days"] > 0) &
        (df["invoice_gap_days"] <= RAPID_RESUBMISSION_DAYS)
    ).astype(int)

    df["_d_burst"] = df["invoice_date"].dt.date
    df["invoice_burst"] = (
        df.groupby(["vendor_id", "_d_burst"])["invoice_amount"]
        .transform("count") >= INVOICE_BURST_COUNT
    ).astype(int)
    df = df.drop(columns=["_d_burst"])

    df["rounded_amount_flag"] = (
        (df["invoice_amount"] > 10_000) &
        (df["invoice_amount"] % 1_000 == 0)
    ).astype(int)

    df["payment_before_invoice"] = 0
    if paid_col_present:
        today = pd.Timestamp.now().normalize()
        df["payment_before_invoice"] = (
            (df["paid_amount"] > 0) & (df["invoice_date"] > today)
        ).astype(int)

    df["amount_deviation"] = (
        (df["invoice_amount"] - df["vendor_mean"]).abs() / (global_iqr + 1.0)
    ).clip(0, 10).fillna(0.0)
    df["extreme_deviation"] = (df["amount_deviation"] > 4.0).astype(int)
    df["overpayment_flag"]  = (df["payment_ratio"] > 1.10).astype(int)
    df["underbilling_flag"] = (po_present & (df["amount_vs_po"] < 0.4)).astype(int)
    df["high_amount_flag"]  = (df["invoice_amount"] > df["vendor_mean"] * 2.5).astype(int)

    df["approval_threshold"] = APPROVAL_THRESHOLD

    if "unknown_vendor" not in df.columns:
        df["unknown_vendor"] = 0

    # ── Behavior score ────────────────────────────────────────────────────────
    df["behavior_score"] = (
        df["weekend_invoice"]        *  8 +
        df["rapid_resubmission"]     * 12 +
        df["invoice_burst"]          * 18 +
        df["rounded_amount_flag"]    * 10 +
        df["payment_before_invoice"] * 25 +
        df["split_cluster_flag"]     * 22 +
        df["shared_bank_flag"]       * 20 +
        df["shell_vendor_flag"]      * 25
    ).clip(0, 100).astype(float)

    df["data_confidence"] = df.apply(
        lambda row: compute_confidence(
            row.to_dict(), po_col_was_present=po_col_was_present
        ),
        axis=1,
    )

    return df
