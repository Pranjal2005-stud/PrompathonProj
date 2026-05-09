"""
canonical_schema.py
-------------------
Defines the single internal invoice schema the entire pipeline operates on.
All upstream parsers MUST produce this schema before entering feature engineering.
"""

# ── Canonical field names with (type, default) ────────────────────────────────
CANONICAL_FIELDS = {
    # Identity
    "invoice_id":           (str,   None),
    "vendor_id":            (str,   "unknown"),
    "vendor_name":          (str,   "unknown"),

    # Financials
    "invoice_amount":       (float, 0.0),
    "approved_amount_po":   (float, 0.0),
    "paid_amount":          (float, 0.0),
    "unit_price":           (float, 0.0),

    # Quantities
    "quantity":             (float, 1.0),
    "approved_quantity_po": (float, 1.0),

    # Dates
    "invoice_date":         (str,   None),

    # Item
    "item_name":            (str,   None),
}

# Fields that are CRITICAL — if missing, confidence drops significantly
CRITICAL_FIELDS = {"invoice_amount", "vendor_name", "invoice_date"}

# Fields that are IMPORTANT — if missing, confidence drops moderately
IMPORTANT_FIELDS = {"approved_amount_po", "paid_amount", "quantity", "vendor_id"}

# Fields that are OPTIONAL — if missing, confidence drops slightly
OPTIONAL_FIELDS = {"unit_price", "approved_quantity_po", "item_name", "invoice_id"}

# PO fields — tracked separately to distinguish "absent" vs "present but zero"
PO_FIELDS = {"approved_amount_po", "approved_quantity_po"}


def compute_confidence(row: dict, po_col_was_present: bool = True) -> float:
    """
    Returns a 0.0–1.0 confidence score based on how many canonical fields
    are present and non-null in the invoice row.

    po_col_was_present: whether the PO column existed in the original upload.
    If False, PO absence does NOT penalize confidence (it's a schema choice,
    not missing data).
    """
    score = 1.0

    for f in CRITICAL_FIELDS:
        val = row.get(f)
        if val is None or val == "" or val == 0.0 or val == "unknown":
            score -= 0.20

    for f in IMPORTANT_FIELDS:
        # Don't penalize PO fields if the column was never in the upload
        if f in PO_FIELDS and not po_col_was_present:
            continue
        val = row.get(f)
        if val is None or val == "" or val == 0.0:
            score -= 0.08

    for f in OPTIONAL_FIELDS:
        val = row.get(f)
        if val is None or val == "":
            score -= 0.02

    return round(max(0.0, min(1.0, score)), 2)
