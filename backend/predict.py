"""
predict.py — Hybrid fraud scoring pipeline.
"""

import logging
import time

import numpy as np
import pandas as pd

from config import (
    ML_FEATURES,
    ML_WEIGHT, RULE_WEIGHT, BEHAVIOR_WEIGHT,
    APPROVE_MAX, REVIEW_MAX, LOW_CONFIDENCE_THRESHOLD,
    ALERT_CRITICAL, ALERT_HIGH, ALERT_MEDIUM,
    MAX_RISK_SCORE,
    BOOST_SHELL_VENDOR, BOOST_SHARED_BANK, BOOST_SHARED_GST,
    BOOST_SPLIT_CLUSTER, BOOST_FORCE_ESCALATE,
)
from rule_engine import apply_rules
from data_loader import load_vendor_master, load_price_benchmark

log = logging.getLogger(__name__)

_OUTPUT_FIELDS = [
    "invoice_id", "vendor_id", "vendor_name",
    "invoice_amount", "approved_amount_po",
    "invoice_date", "created_at",
    "decision", "risk_score", "ml_risk_score", "anomaly_score",
    "rule_score", "behavior_score", "data_confidence",
    "fraud_type", "alert_level", "rule_flags", "reason",
    "network_risk_score", "shared_bank_account",
    "split_cluster_flag", "cluster_id",
    "vendor_degree", "co_occurrence_score", "shell_vendor_flag",
    "shared_bank_flag", "shared_gst_flag",
]


def _enrich_external(df: pd.DataFrame) -> pd.DataFrame:
    vendor_master = load_vendor_master()
    price_benchmark = load_price_benchmark()

    if (
        "vendor_name" in df.columns
        and not vendor_master.empty
        and "vendor_name" in vendor_master.columns
    ):
        extra = [c for c in vendor_master.columns
                 if c == "vendor_name" or c not in df.columns]
        df = df.merge(vendor_master[extra], on="vendor_name", how="left")
        df["unknown_vendor"] = (
            ~df["vendor_name"].isin(vendor_master["vendor_name"].values)
        ).astype(int)
        if "bank_account_x" in df.columns and "bank_account_y" in df.columns:
            df["bank_account_mismatch"] = (
                df["bank_account_x"].astype(str) != df["bank_account_y"].astype(str)
            ).astype(int)
            df = df.drop(columns=["bank_account_x", "bank_account_y"], errors="ignore")
        else:
            df["bank_account_mismatch"] = 0
    else:
        df["unknown_vendor"] = 0
        df["bank_account_mismatch"] = 0

    if "bank_account" in df.columns and "vendor_id" in df.columns:
        counts = df.groupby("bank_account")["vendor_id"].transform("nunique")
        df["shared_bank_account"] = (counts > 1).astype(int)
    else:
        df["shared_bank_account"] = df.get(
            "shared_bank_flag", pd.Series(0, index=df.index)
        )

    def _price_flag(row) -> str:
        item = str(row.get("item_name", "") or "").strip()
        if not item or item in ("nan", "None", "unknown"):
            return "NORMAL"
        amount = float(row.get("invoice_amount", 0) or 0)
        if item in price_benchmark:
            lo = price_benchmark[item].get("min", 0)
            hi = price_benchmark[item].get("max", float("inf"))
            if amount > hi:
                return "OVERPRICED"
            if amount < lo:
                return "UNDERPRICED"
        return "NORMAL"

    df["price_flag"] = df.apply(_price_flag, axis=1)
    return df


def _normalize_iforest(raw: np.ndarray) -> np.ndarray:
    if len(raw) == 0:
        return np.array([])
    inverted = -raw
    p10, p90 = np.percentile(inverted, 10), np.percentile(inverted, 90)
    rng = p90 - p10
    if rng < 1e-6:
        return np.full_like(inverted, 30.0, dtype=float)
    return np.clip(15.0 + 70.0 * (inverted - p10) / rng, 0.0, 100.0)


def _alert_level(score: float) -> str:
    if score >= ALERT_CRITICAL:
        return "CRITICAL"
    if score >= ALERT_HIGH:
        return "HIGH"
    if score >= ALERT_MEDIUM:
        return "MEDIUM"
    return "LOW"


def _build_reason(row) -> str:
    flags = str(row.get("rule_flags", "") or "")
    if flags and flags != "None":
        return flags
    parts = []
    if row.get("shared_bank_flag", 0):
        parts.append("Multiple vendors share same bank account")
    if row.get("shared_gst_flag", 0):
        parts.append("Multiple vendors share same GSTIN")
    if row.get("shell_vendor_flag", 0):
        parts.append("Vendor in high-risk procurement network")
    if row.get("split_cluster_flag", 0):
        parts.append("Invoices clustered below approval threshold")
    if row.get("amount_vs_po", 1.0) > 1.15:
        parts.append("Overbilling")
    if row.get("amount_deviation", 0) > 1.5:
        parts.append("High Deviation")
    if row.get("payment_ratio", 0) > 1.10:
        parts.append("Overpayment")
    if row.get("duplicate_pattern", 0):
        parts.append("Duplicate Pattern")
    if row.get("missing_po", 0):
        parts.append("Missing PO")
    if row.get("extreme_deviation", 0):
        parts.append("Extreme Deviation")
    if row.get("unknown_vendor", 0):
        parts.append("Unknown Vendor")
    if row.get("bank_account_mismatch", 0):
        parts.append("Bank Account Mismatch")
    if row.get("co_occurrence_score", 0) >= 50:
        parts.append("Suspicious coordination patterns")
    if row.get("data_confidence", 1.0) < 0.35:
        parts.append("Low Data Confidence")
    return ", ".join(parts) if parts else "Normal"


def get_prediction(df: pd.DataFrame, model=None, scaler=None) -> pd.DataFrame:
    t0 = time.perf_counter()

    df = _enrich_external(df)

    missing = [f for f in ML_FEATURES if f not in df.columns]
    if missing:
        log.warning("[predict] Filling %d missing ML features: %s", len(missing), missing)
    for col in ML_FEATURES:
        if col not in df.columns:
            df[col] = 0.0

    X = (
        df[ML_FEATURES]
        .copy()
        .astype(float)
        .replace([np.inf, -np.inf], 0.0)
        .fillna(0.0)
        .clip(-1e6, 1e6)
    )

    if X.shape[1] != len(ML_FEATURES):
        raise ValueError(
            f"[predict] Feature mismatch: expected {len(ML_FEATURES)}, got {X.shape[1]}"
        )

    # ML score
    if model is not None and scaler is not None:
        try:
            X_scaled = scaler.transform(X)
            if hasattr(model, "predict_proba"):
                prob = model.predict_proba(X_scaled)[:, 1]
                df["ml_risk_score"] = np.clip(prob * 100, 0, 100)
            else:
                df["ml_risk_score"] = _normalize_iforest(
                    model.decision_function(X_scaled)
                )
            df["anomaly_score"] = df["ml_risk_score"].copy()
            log.info(
                "[predict] ML scores — min=%.1f mean=%.1f max=%.1f",
                df["ml_risk_score"].min(),
                df["ml_risk_score"].mean(),
                df["ml_risk_score"].max(),
            )
        except Exception as exc:
            log.error("[predict] ML scoring failed: %s", exc)
            df["ml_risk_score"] = 30.0
            df["anomaly_score"] = 0.0
    else:
        log.warning("[predict] No model loaded — using rule+behavior scores only")
        df["ml_risk_score"] = 30.0
        df["anomaly_score"] = 0.0

    # Rule engine
    df = apply_rules(df)

    if "behavior_score" not in df.columns:
        df["behavior_score"] = 0.0

    # Weighted blend
    df["risk_score"] = (
        ML_WEIGHT * df["ml_risk_score"].fillna(30.0)
        + RULE_WEIGHT * df["rule_score"].fillna(0.0)
        + BEHAVIOR_WEIGHT * df["behavior_score"].fillna(0.0)
    ).clip(0.0, MAX_RISK_SCORE)

    # Confidence adjustment
    if "data_confidence" in df.columns:
        conf = df["data_confidence"].clip(0.1, 1.0)
        df["risk_score"] = (
            df["risk_score"] * conf + 40.0 * (1.0 - conf)
        ).clip(0.0, MAX_RISK_SCORE)

    # Signal boosts
    boost = pd.Series(0.0, index=df.index)

    if "shell_vendor_flag" in df.columns:
        shell_cond = (
            (df["shell_vendor_flag"].fillna(0) == 1)
            & (df.get("co_occurrence_score", pd.Series(0, index=df.index)) >= 65)
        )
        boost += shell_cond.astype(int) * BOOST_SHELL_VENDOR

    if "shared_bank_flag" in df.columns:
        bank_cond = (
            (df["shared_bank_flag"].fillna(0) == 1)
            & (df.get("vendor_degree", pd.Series(0, index=df.index)) >= 2)
        )
        boost += bank_cond.astype(int) * BOOST_SHARED_BANK

    if "shared_gst_flag" in df.columns:
        gst_cond = (
            (df["shared_gst_flag"].fillna(0) == 1)
            & (df.get("cluster_size", pd.Series(0, index=df.index)) >= 3)
        )
        boost += gst_cond.astype(int) * BOOST_SHARED_GST

    if "split_cluster_flag" in df.columns:
        split_cond = (
            (df["split_cluster_flag"].fillna(0) == 1)
            & (df.get("rule_score", pd.Series(0, index=df.index)) >= 45)
        )
        boost += split_cond.astype(int) * BOOST_SPLIT_CLUSTER

    if "force_escalate" in df.columns:
        boost += df["force_escalate"].fillna(False).astype(int) * BOOST_FORCE_ESCALATE

    boost = boost.clip(0, 25)
    df["risk_score"] = (df["risk_score"] + boost).clip(0.0, MAX_RISK_SCORE)

    # Decision
    def _decision(row) -> str:
        score = float(row["risk_score"])
        conf = float(row.get("data_confidence", 1.0))
        escalate = bool(row.get("force_escalate", False))
        if escalate and score >= 75:
            return "BLOCK"
        if conf < LOW_CONFIDENCE_THRESHOLD:
            return "REVIEW"
        if score >= 85:
            return "BLOCK"
        if score >= 50:
            return "REVIEW"
        return "APPROVE"

    df["decision"] = df.apply(_decision, axis=1)

    df["reason"] = df.apply(_build_reason, axis=1)
    df["alert_level"] = df["risk_score"].apply(_alert_level)

    if "fraud_type" in df.columns:
        ml_anomaly = (df["fraud_type"] == "Normal") & (df["ml_risk_score"] > 55)
        df.loc[ml_anomaly, "fraud_type"] = "Anomalous Pattern"

    # Network risk score
    df["network_risk_score"] = (
        df.get("vendor_degree",       pd.Series(0,   index=df.index)).fillna(0).clip(0, 10) * 2.0
        + df.get("pagerank",          pd.Series(0.0, index=df.index)).fillna(0) * 12.0
        + df.get("shared_bank_flag",  pd.Series(0,   index=df.index)).fillna(0) * 18
        + df.get("shared_gst_flag",   pd.Series(0,   index=df.index)).fillna(0) * 12
        + df.get("shell_vendor_flag", pd.Series(0,   index=df.index)).fillna(0) * 20
        + df.get("co_occurrence_score", pd.Series(0.0, index=df.index)).fillna(0) * 0.12
    ).clip(0, 100)

    df["confidence"] = df.get("data_confidence", pd.Series(1.0, index=df.index))
    df["created_at"] = df["invoice_date"].apply(
        lambda d: str(d.date()) if pd.notna(d) else None
    )

    blocked = int((df["decision"] == "BLOCK").sum())
    review  = int((df["decision"] == "REVIEW").sum())
    flagged = int((df["rule_flags"] != "None").sum())
    elapsed = time.perf_counter() - t0

    log.info(
        "[predict] %d invoices | BLOCK=%d REVIEW=%d | flagged=%d | "
        "risk mean=%.1f max=%.1f | %.3fs",
        len(df), blocked, review, flagged,
        df["risk_score"].mean(), df["risk_score"].max(), elapsed,
    )

    top5 = df.nlargest(5, "risk_score")[
        ["invoice_id", "vendor_name", "risk_score", "rule_score",
         "ml_risk_score", "fraud_type", "rule_flags"]
    ].to_dict(orient="records")
    for r in top5:
        log.info("[predict] TOP: %s", r)

    keep = [c for c in _OUTPUT_FIELDS if c in df.columns]
    result = df[keep].copy()

    for col in ("risk_score", "ml_risk_score", "anomaly_score",
                "rule_score", "behavior_score", "network_risk_score"):
        if col in result.columns:
            result[col] = (
                pd.to_numeric(result[col], errors="coerce")
                .fillna(0.0)
                .round(2)
            )

    return result
