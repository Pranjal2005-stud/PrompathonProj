"""
canonical_schema.py
-------------------
Defines the single internal invoice schema the entire pipeline operates on.
All upstream parsers MUST produce this schema before entering feature engineering.
"""

CANONICAL_FIELDS = {
    "invoice_id":           (str,   None),
    "vendor_id":            (str,   "unknown"),
    "vendor_name":          (str,   "unknown"),
    "invoice_amount":       (float, 0.0),
    "approved_amount_po":   (float, 0.0),
    "paid_amount":          (float, 0.0),
    "unit_price":           (float, 0.0),
    "quantity":             (float, 1.0),
    "approved_quantity_po": (float, 1.0),
    "invoice_date":         (str,   None),
    "item_name":            (str,   None),
}

CRITICAL_FIELDS  = {"invoice_amount", "vendor_name", "invoice_date"}
IMPORTANT_FIELDS = {"approved_amount_po", "paid_amount", "quantity", "vendor_id"}
OPTIONAL_FIELDS  = {"unit_price", "approved_quantity_po", "item_name", "invoice_id"}
PO_FIELDS        = {"approved_amount_po", "approved_quantity_po"}


def compute_confidence(row: dict, po_col_was_present: bool = True) -> float:
    score = 1.0

    for f in CRITICAL_FIELDS:
        val = row.get(f)
        if val is None or val == "" or val == 0.0 or val == "unknown":
            score -= 0.20

    for f in IMPORTANT_FIELDS:
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
