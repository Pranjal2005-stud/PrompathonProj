"""
config.py
---------
Central configuration for the procurement fraud detection system.
All thresholds, weights, and feature names originate here.
"""

# =============================================================================
# ML FEATURES  (18 — must match training pipeline exactly)
# =============================================================================

ML_FEATURES = [
    "amount",
    "vendor_mean",
    "vendor_std",
    "amount_zscore",
    "vendor_frequency",
    "invoice_gap_days",
    "shared_bank_flag",
    "shared_gst_flag",
    "shared_address_flag",
    "window_invoice_count",
    "window_vendor_count",
    "split_cluster_flag",
    "vendor_degree",
    "community_size",
    "pagerank",
]

# =============================================================================
# RISK SCORE WEIGHTS
# =============================================================================

ML_WEIGHT       = 0.55
RULE_WEIGHT     = 0.30
BEHAVIOR_WEIGHT = 0.15

TOTAL_WEIGHT = ML_WEIGHT + RULE_WEIGHT + BEHAVIOR_WEIGHT  # = 1.0

# =============================================================================
# DECISION THRESHOLDS
# =============================================================================

APPROVE_MAX = 50.0   # lowered: fewer false negatives
REVIEW_MAX  = 75.0   # lowered: more invoices escalate to BLOCK

ALERT_MEDIUM   = 50.0
ALERT_HIGH     = 70.0
ALERT_CRITICAL = 90.0

LOW_CONFIDENCE_THRESHOLD = 0.35

# =============================================================================
# SCORE BOOSTS — applied directly to risk_score after blend
# These ensure high-signal fraud patterns always surface
# =============================================================================

BOOST_SHELL_VENDOR    = 12.0   # shell_vendor_flag == 1
BOOST_SHARED_BANK     = 6.0   # shared_bank_flag == 1
BOOST_SHARED_GST      = 4.0   # shared_gst_flag == 1
BOOST_SPLIT_CLUSTER   = 8.0   # split_cluster_flag == 1
BOOST_FORCE_ESCALATE  = 10.0   # force_escalate == True

# =============================================================================
# APPROVAL / SPLITTING THRESHOLDS
# =============================================================================

APPROVAL_THRESHOLD  = 100_000.0

THRESHOLD_HUG_LOW   = 0.92    # lowered: catch more threshold-hugging
THRESHOLD_HUG_HIGH  = 0.999

SPLIT_WINDOW_DAYS   = 7
SPLIT_MIN_INVOICES  = 4    # lowered: catch 2-invoice splits too
SPLIT_CLUSTER_RATIO = 1.55     # lowered: more sensitive to clustering

# =============================================================================
# GRAPH THRESHOLDS
# =============================================================================

GRAPH_HIGH_DEGREE        = 5   # lowered: even 2 connections is suspicious
GRAPH_SHELL_CLUSTER_SIZE = 3   # lowered
GRAPH_PAGERANK_HIGH      = 0.10
GRAPH_BETWEENNESS_HIGH   = 0.10   # kept for explain.py compat

# co_occurrence_score is 0–100 composite
CO_OCCURRENCE_HIGH = 78.0   # lowered: catch more coordination patterns

# =============================================================================
# RULE ENGINE THRESHOLDS
# =============================================================================

OVERBILLING_RATIO       = 1.35   # lowered: 15% over PO is suspicious
QUANTITY_MISMATCH_RATIO = 1.40
OVERPAYMENT_RATIO       = 1.18   # lowered
UNDERBILLING_RATIO      = 0.40
HIGH_DEVIATION_IQR      = 2.0    # lowered
EXTREME_DEVIATION_IQR   = 4.0    # lowered
RAPID_RESUBMISSION_DAYS = 2      # widened window
INVOICE_BURST_COUNT     = 5     # lowered: 3 invoices same day = burst
FIRST_INVOICE_MULTIPLIER = 2.5   # lowered

# =============================================================================
# GRAPH FEATURE WEIGHTS
# =============================================================================

GRAPH_WEIGHT_BANK    = 3.0
GRAPH_WEIGHT_GST     = 2.5
GRAPH_WEIGHT_ADDRESS = 1.5

# =============================================================================
# SAFETY LIMITS
# =============================================================================

MAX_ZSCORE        = 10.0
MAX_RATIO         = 20.0
MAX_BEHAVIOR_SCORE = 100.0
MAX_RULE_SCORE    = 100.0
MAX_RISK_SCORE    = 100.0
