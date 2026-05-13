"""
predict.py
----------
Hybrid fraud scoring engine.

Scoring formula:
    risk_score = ML_WEIGHT * ml_risk_score
               + RULE_WEIGHT * rule_score
               + BEHAVIOR_WEIGHT * behavior_score

Decision thresholds (from config):
    < APPROVE_MAX (35) → APPROVE
    < REVIEW_MAX  (65) → REVIEW
    >= REVIEW_MAX      → BLOCK

Target distribution: ~75% APPROVE, ~18% REVIEW, ~7% BLOCK

Fixes applied
─────────────
1. No-model fallback: ml_risk_score now mirrors rule_score (computed after
   rule engine) instead of a flat 25.0 that artificially caps risk_score
   below REVIEW_MAX even when every rule fires.

2. network_risk_score is now computed BEFORE _decide so the shell-vendor
   block condition can actually read it.

3. Low-confidence guard now allows BLOCK for force_escalate cases and for
   very high scores (≥ 80), preventing genuine fraud from being silently
   downgraded to REVIEW on incomplete data.
"""

import numpy as np
import pandas as pd

from rule_engine import apply_rules
from data_loader import load_vendor_master, load_price_benchmark
from config import (
    ML_FEATURES,
    ML_WEIGHT,
    RULE_WEIGHT,
    BEHAVIOR_WEIGHT,
    APPROVE_MAX,
    REVIEW_MAX,
    LOW_CONFIDENCE_THRESHOLD,
    ALERT_CRITICAL,
    ALERT_HIGH,
    ALERT_MEDIUM,
)


# ── ML score normalization ────────────────────────────────────────────────────

def _normalize_ml_score(raw: np.ndarray) -> np.ndarray:
    """
    Map IsolationForest decision_function output to 0-100.
    Anchors p5 → 10 and p95 → 90 so the full range is used
    without compressing everything into a narrow band.
    """
    if len(raw) == 0:
        return np.array([])
    p5  = np.percentile(raw, 5)
    p95 = np.percentile(raw, 95)
    rng = p95 - p5
    if rng < 1e-6:
        return np.full_like(raw, 25.0, dtype=float)
    scaled = 10.0 + 80.0 * (raw - p5) / rng
    return np.clip(scaled, 0.0, 100.0)


# ── External data enrichment ──────────────────────────────────────────────────

def _enrich_external(df: pd.DataFrame) -> pd.DataFrame:
    vendor_master   = load_vendor_master()
    price_benchmark = load_price_benchmark()

    if (
        "vendor_name" in df.columns
        and not vendor_master.empty
        and "vendor_name" in vendor_master.columns
    ):
        extra = [c for c in vendor_master.columns if c == "vendor_name" or c not in df.columns]
        df = df.merge(vendor_master[extra], on="vendor_name", how="left")

        df["unknown_vendor"] = df["vendor_name"].apply(
            lambda v: 0 if v in vendor_master["vendor_name"].values else 1
        )
        if "bank_account_x" in df.columns and "bank_account_y" in df.columns:
            df["bank_account_mismatch"] = (
                df["bank_account_x"].astype(str) != df["bank_account_y"].astype(str)
            ).astype(int)
            df = df.drop(columns=["bank_account_x", "bank_account_y"], errors="ignore")
        else:
            df["bank_account_mismatch"] = 0
    else:
        df["unknown_vendor"]        = 0
        df["bank_account_mismatch"] = 0

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


# ── Fraud type classifier ─────────────────────────────────────────────────────

def _assign_fraud_type(row) -> str:
    flags = str(row.get("rule_flags", "") or "")
    if "Shell Vendor Cluster"    in flags: return "Shell Vendor Fraud"
    if "Invoice Splitting Ring"  in flags: return "Invoice Splitting Fraud"
    if "Vendor Collusion Pattern"in flags: return "Vendor Collusion Fraud"
    if "Threshold Avoidance"     in flags: return "Threshold Avoidance Fraud"
    if "Shared Bank Account"     in flags: return "Shared Account Fraud"
    if "Duplicate Invoice"       in flags: return "Duplicate Invoice Fraud"
    if "Overbilling"             in flags: return "Overbilling Fraud"
    if row.get("risk_score", 0) >= ALERT_HIGH:
        return "Anomalous Procurement Pattern"
    return "Normal"


# ── Alert level ───────────────────────────────────────────────────────────────

def _assign_alert_level(score: float) -> str:
    if score >= ALERT_CRITICAL: return "CRITICAL"
    if score >= ALERT_HIGH:     return "HIGH"
    if score >= ALERT_MEDIUM:   return "MEDIUM"
    return "LOW"


# ── Human-readable reason ─────────────────────────────────────────────────────

def _build_reason(row) -> str:
    flags = str(row.get("rule_flags", "") or "")
    if flags and flags != "None":
        return flags
    parts = []
    if row.get("shared_bank_flag",    0) == 1: parts.append("Shared bank account")
    if row.get("split_cluster_flag",  0) == 1: parts.append("Invoice splitting pattern")
    if row.get("vendor_degree",       0) >= 4:  parts.append("Suspicious vendor network")
    if row.get("amount_deviation",    0) >  2:  parts.append("Amount deviation from history")
    if row.get("weekend_invoice",     0) == 1: parts.append("Weekend invoice")
    if row.get("rounded_amount_flag", 0) == 1: parts.append("Rounded amount")
    return ", ".join(parts) if parts else "No major fraud indicators"


# ── Network risk score helper (extracted so it runs before _decide) ───────────

def _compute_network_risk(df: pd.DataFrame) -> pd.DataFrame:
    """
    Computes network_risk_score (0-100) and attaches it to df in-place.
    Must be called BEFORE _decide so the shell-vendor block condition works.
    co_occurrence_score is already 0-100 from graph_engine.
    """
    co_occ      = df.get("co_occurrence_score",  pd.Series(0.0, index=df.index))
    vendor_deg  = df.get("vendor_degree",        pd.Series(0.0, index=df.index))
    shared_bank = df.get("shared_bank_flag",     pd.Series(0,   index=df.index))
    shared_gst  = df.get("shared_gst_flag",      pd.Series(0,   index=df.index))
    shell_flag  = df.get("shell_vendor_flag",    pd.Series(0,   index=df.index))

    max_deg = float(vendor_deg.max()) if vendor_deg.max() > 0 else 1.0

    df["network_risk_score"] = (
        co_occ * 0.40 +
        (vendor_deg / max_deg * 100) * 0.25 +
        shared_bank * 20 +
        shared_gst  * 10 +
        shell_flag  * 15
    ).clip(0, 100).fillna(0.0)

    return df


# ── Main prediction pipeline ──────────────────────────────────────────────────

def get_prediction(df: pd.DataFrame, model=None, scaler=None) -> pd.DataFrame:
    df = _enrich_external(df)

    # Ensure all ML features exist
    for col in ML_FEATURES:
        if col not in df.columns:
            df[col] = 0.0

    X = df[ML_FEATURES].copy().astype(float).fillna(0.0).clip(-1e6, 1e6)

    # ── ML scoring ────────────────────────────────────────────────────────────
    has_model = model is not None and scaler is not None
    if has_model:
        try:
            X_scaled = scaler.transform(X)
            if hasattr(model, "predict_proba"):
                # XGBoost / classifier
                probs = model.predict_proba(X_scaled)[:, 1]
                df["ml_risk_score"] = (probs * 100).clip(0, 100)
            else:
                # IsolationForest
                raw = model.decision_function(X_scaled)
                df["ml_risk_score"] = _normalize_ml_score(-raw)
            df["anomaly_score"] = df["ml_risk_score"]
        except Exception as e:
            print(f"[predict] ML scoring failed: {e}")
            has_model = False  # fall through to rule-based fallback

    # ── Rule engine ───────────────────────────────────────────────────────────
    # Run before setting the fallback ml_risk_score so we can use rule_score
    # as the ML proxy when no trained model is available.
    df = apply_rules(df)

    if not has_model:
        # FIX 1: Use rule_score as ML proxy instead of flat 25.0.
        # A flat 25 artificially caps risk_score below REVIEW_MAX even when
        # every rule fires, making BLOCK decisions impossible without a model.
        df["ml_risk_score"] = df["rule_score"].clip(0, 100)
        df["anomaly_score"] = df["ml_risk_score"]

    if "behavior_score" not in df.columns:
        df["behavior_score"] = 0.0

    # ── Weighted blend ────────────────────────────────────────────────────────
    df["risk_score"] = (
        ML_WEIGHT       * df["ml_risk_score"] +
        RULE_WEIGHT     * df["rule_score"]     +
        BEHAVIOR_WEIGHT * df["behavior_score"]
    ).clip(0.0, 100.0)

    # ── Confidence adjustment ─────────────────────────────────────────────────
    # Low-confidence invoices are pulled toward 40 (mid-REVIEW zone).
    # High-confidence invoices are unaffected.
    if "data_confidence" in df.columns:
        conf    = df["data_confidence"].clip(0.2, 1.0)
        neutral = 40.0
        df["risk_score"] = (
            df["risk_score"] * conf + neutral * (1.0 - conf)
        ).clip(0.0, 100.0)

    # FIX 2: Compute network_risk_score BEFORE _decide so the shell-vendor
    # block condition inside _decide can actually read it.
    df = _compute_network_risk(df)

    # ── Decision engine ───────────────────────────────────────────────────────
    def _decide(row) -> str:
        score    = float(row["risk_score"])
        conf     = float(row.get("data_confidence", 1.0))
        escalate = bool(row.get("force_escalate", False))

        # Critical combination → BLOCK if score is meaningful
        if escalate and score >= 50.0:
            return "BLOCK"

        # Direct network fraud: shared bank + split invoices
        if (
            row.get("shared_bank_flag",   0) == 1 and
            row.get("split_cluster_flag", 0) == 1 and
            score >= 50.0
        ):
            return "BLOCK"

        # Shell vendor with high network risk
        # (network_risk_score is now populated before this runs — FIX 2)
        if (
            row.get("shell_vendor_flag", 0) == 1 and
            row.get("network_risk_score", 0) >= 60 and
            score >= 45.0
        ):
            return "BLOCK"

        # FIX 3: Low confidence → REVIEW, BUT still allow BLOCK when the
        # evidence is overwhelming (force_escalate already handled above;
        # this catches non-escalated invoices with very high raw scores).
        # Previously this gate ran unconditionally, silently downgrading
        # every high-risk invoice with imperfect data to REVIEW.
        if conf < LOW_CONFIDENCE_THRESHOLD and score < 80.0:
            return "REVIEW"

        # Standard thresholds from config
        if score >= REVIEW_MAX:
            return "BLOCK"
        if score >= APPROVE_MAX:
            return "REVIEW"
        return "APPROVE"

    df["decision"] = df.apply(_decide, axis=1)

    # ── Human-readable outputs ────────────────────────────────────────────────
    df["reason"]      = df.apply(_build_reason, axis=1)
    df["fraud_type"]  = df.apply(_assign_fraud_type, axis=1)
    df["alert_level"] = df["risk_score"].apply(_assign_alert_level)
    df["confidence"]  = df.get("data_confidence", pd.Series(1.0, index=df.index))

    if "invoice_date" in df.columns:
        df["created_at"] = df["invoice_date"].apply(
            lambda d: str(d.date()) if pd.notna(d) else None
        )

    return df


# ── Vendor risk summary ───────────────────────────────────────────────────────

def compute_vendor_risk(df: pd.DataFrame) -> list:
    records = []
    for vendor_id, grp in df.groupby("vendor_id"):
        records.append({
            "vendor_id":          str(vendor_id),
            "vendor_name":        str(grp["vendor_name"].iloc[0]) if "vendor_name" in grp.columns else vendor_id,
            "avg_risk_score":     round(float(grp["risk_score"].mean()), 1),
            "max_risk_score":     round(float(grp["risk_score"].max()),  1),
            "invoice_count":      len(grp),
            "blocked_count":      int((grp["decision"] == "BLOCK").sum()),
            "network_risk_score": round(float(grp["network_risk_score"].mean()), 1),
            "shell_vendor":       int(grp.get("shell_vendor_flag", pd.Series(0)).max()),
            "risk_trend":         "HIGH" if grp["risk_score"].mean() > REVIEW_MAX
                                  else "MEDIUM" if grp["risk_score"].mean() > APPROVE_MAX
                                  else "LOW",
        })
    records.sort(key=lambda x: -x["avg_risk_score"])
    return records