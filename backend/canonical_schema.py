"""
canonical_schema.py
-------------------
Defines the canonical invoice schema used internally by the system.

Every parser must convert incoming data into this schema before:
- feature engineering
- rule processing
- ML inference
"""

# =============================================================================
# CANONICAL FIELDS
# =============================================================================

CANONICAL_FIELDS = {

    # Invoice identifiers
    "invoice_id": (str, None),

    # Vendor info
    "vendor_id": (str, "unknown"),
    "vendor_name": (str, "unknown"),

    # Financials
    "invoice_amount": (float, 0.0),
    "approved_amount_po": (float, 0.0),
    "paid_amount": (float, 0.0),

    # Quantity details
    "quantity": (float, 1.0),
    "approved_quantity_po": (float, 1.0),
    "unit_price": (float, 0.0),

    # Invoice metadata
    "invoice_date": (str, None),
    "item_name": (str, "unknown"),

    # Graph metadata
    "bank_account": (str, "unknown"),
    "gst_number": (str, "unknown"),
    "vendor_address": (str, "unknown"),
}

# =============================================================================
# FIELD GROUPS
# =============================================================================

CRITICAL_FIELDS = {
    "invoice_amount",
    "vendor_name",
    "invoice_date",
}

IMPORTANT_FIELDS = {
    "vendor_id",
    "approved_amount_po",
    "paid_amount",
    "quantity",
}

OPTIONAL_FIELDS = {
    "invoice_id",
    "item_name",
    "unit_price",
    "approved_quantity_po",
}

PO_FIELDS = {
    "approved_amount_po",
    "approved_quantity_po",
}

# =============================================================================
# CONFIDENCE SCORE
# =============================================================================

def compute_confidence(
    row: dict,
    po_col_was_present: bool = True
) -> float:

    score = 1.0

    # -------------------------------------------------------------------------
    # CRITICAL FIELDS
    # -------------------------------------------------------------------------

    for field in CRITICAL_FIELDS:

        value = row.get(field)

        if (
            value is None or
            value == "" or
            value == 0.0 or
            value == "unknown"
        ):
            score -= 0.20

    # -------------------------------------------------------------------------
    # IMPORTANT FIELDS
    # -------------------------------------------------------------------------

    for field in IMPORTANT_FIELDS:

        if (
            field in PO_FIELDS and
            not po_col_was_present
        ):
            continue

        value = row.get(field)

        if (
            value is None or
            value == "" or
            value == 0.0
        ):
            score -= 0.08

    # -------------------------------------------------------------------------
    # OPTIONAL FIELDS
    # -------------------------------------------------------------------------

    for field in OPTIONAL_FIELDS:

        value = row.get(field)

        if value is None or value == "":
            score -= 0.02

    # -------------------------------------------------------------------------
    # CLAMP
    # -------------------------------------------------------------------------

    score = max(0.0, min(1.0, score))

    return round(score, 2)