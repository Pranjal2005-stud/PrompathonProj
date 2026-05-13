"""
config.py
---------
Single source of truth for all thresholds, weights, and feature definitions.
Import from here — never hardcode magic numbers in other modules.
"""

# ── ML Feature list (18 features) — MUST match training pipeline exactly ──────
ML_FEATURES = [
    "amount",
    "vendor_mean",
    "vendor_std",
    "amount_zscore",
    "amount_ratio",
    "invoice_gap_days",
    "vendor_frequency",
    "split_cluster_flag",
    "vendor_degree",
    "cluster_size",
    "window_invoice_count",
    "window_vendor_count",
    "cluster_amount_ratio",
    "co_occurrence_score",
    "entropy_score",
    "shared_bank_flag",
    "shared_gst_flag",
    "shared_address_flag",
]

# ── Scoring weights ────────────────────────────────────────────────────────────
ML_WEIGHT       = 0.45
RULE_WEIGHT     = 0.40
BEHAVIOR_WEIGHT = 0.15

# ── Decision thresholds ────────────────────────────────────────────────────────
APPROVE_MAX = 35.0   # risk_score < 35  → APPROVE
REVIEW_MAX  = 65.0   # risk_score < 65  → REVIEW, else BLOCK
LOW_CONFIDENCE_THRESHOLD = 0.35

# ── Approval / splitting thresholds ───────────────────────────────────────────
APPROVAL_THRESHOLD        = 100_000.0   # ₹ — invoices above this need extra approval
SPLIT_WINDOW_DAYS         = 7           # days window for split invoice detection
SPLIT_MIN_INVOICES        = 3           # min invoices in window to flag splitting
SPLIT_CLUSTER_RATIO       = 1.5         # cluster_amount / vendor_mean ratio to flag
THRESHOLD_HUG_LOW         = 0.90        # 90% of approval threshold
THRESHOLD_HUG_HIGH        = 0.999       # 99.9% of approval threshold

# ── Graph thresholds ───────────────────────────────────────────────────────────
GRAPH_HIGH_DEGREE         = 4           # vendor_degree above this is suspicious
GRAPH_SHELL_CLUSTER_SIZE  = 3           # cluster_size above this triggers shell flag
GRAPH_PAGERANK_HIGH       = 0.15        # pagerank above this is suspicious
GRAPH_BETWEENNESS_HIGH    = 0.10        # betweenness_centrality above this is suspicious

# ── Rule engine thresholds ─────────────────────────────────────────────────────
OVERBILLING_RATIO         = 1.20        # invoice > 120% of PO
QUANTITY_MISMATCH_RATIO   = 1.60        # quantity > 160% of approved
OVERPAYMENT_RATIO         = 1.15        # paid > 115% of invoice
UNDERBILLING_RATIO        = 0.40        # invoice < 40% of PO
HIGH_DEVIATION_IQR        = 2.0         # IQR multiplier for high deviation
EXTREME_DEVIATION_IQR     = 5.0         # IQR multiplier for extreme deviation
RAPID_RESUBMISSION_DAYS   = 2           # gap <= 2 days = rapid resubmission
INVOICE_BURST_COUNT       = 4           # 4+ invoices same vendor same day
CO_OCCURRENCE_HIGH        = 0.70        # normalized co_occurrence_score threshold
FIRST_INVOICE_MULTIPLIER  = 2.0         # first invoice > 2x dataset median

# ── Alert levels ───────────────────────────────────────────────────────────────
ALERT_CRITICAL = 85.0
ALERT_HIGH     = 65.0
ALERT_MEDIUM   = 45.0
