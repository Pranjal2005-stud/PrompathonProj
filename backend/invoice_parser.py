"""
invoice_parser.py
-----------------
Parses uploaded CSV/Excel files into a canonical DataFrame.
Handles column aliasing, type coercion, and schema normalization.
"""

import io
import pandas as pd
from fastapi import UploadFile
from canonical_schema import CANONICAL_FIELDS

# Column aliases — maps common alternative names to canonical names
ALIASES = {
    "id":                     "invoice_id",
    "invoice_no":             "invoice_id",
    "invoice_number":         "invoice_id",
    "inv_id":                 "invoice_id",
    "vendor":                 "vendor_name",
    "supplier_name":          "vendor_name",
    "supplier":               "vendor_name",
    "vendor_code":            "vendor_id",
    "supplier_id":            "vendor_id",
    "amount":                 "invoice_amount",
    "total_amount":           "invoice_amount",
    "invoice_total":          "invoice_amount",
    "po_amount":              "approved_amount_po",
    "po_approved_amount":     "approved_amount_po",
    "approved_amount":        "approved_amount_po",
    "payment":                "paid_amount",
    "amount_paid":            "paid_amount",
    "qty":                    "quantity",
    "invoice_qty":            "quantity",
    "po_qty":                 "approved_quantity_po",
    "approved_qty":           "approved_quantity_po",
    "date":                   "invoice_date",
    "inv_date":               "invoice_date",
    "price":                  "unit_price",
    "rate":                   "unit_price",
    "item":                   "item_name",
    "description":            "item_name",
    "product":                "item_name",
}


def _normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Lowercase + strip column names, then apply aliases."""
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
    df = df.rename(columns={k: v for k, v in ALIASES.items() if k in df.columns})
    return df


def _coerce_types(df: pd.DataFrame) -> pd.DataFrame:
    """Coerce each canonical field to its declared type."""
    for field, (typ, default) in CANONICAL_FIELDS.items():
        if field not in df.columns:
            df[field] = default
            continue
        if typ == float:
            df[field] = pd.to_numeric(df[field], errors="coerce").fillna(default or 0.0)
        elif typ == str:
            df[field] = df[field].astype(str).replace("nan", None).replace("None", None)
    return df


async def parse_input(file: UploadFile) -> pd.DataFrame:
    """Read uploaded file (CSV or Excel) and return normalized DataFrame."""
    content = await file.read()
    name = (file.filename or "").lower()

    if name.endswith((".xlsx", ".xls")):
        df = pd.read_excel(io.BytesIO(content))
    else:
        # Try common encodings
        for enc in ("utf-8", "latin-1", "cp1252"):
            try:
                df = pd.read_csv(io.BytesIO(content), encoding=enc)
                break
            except UnicodeDecodeError:
                continue
        else:
            df = pd.read_csv(io.BytesIO(content), encoding="utf-8", errors="replace")

    df = _normalize_columns(df)

    # Track which canonical columns were present before filling defaults
    present_cols = set(df.columns) & set(CANONICAL_FIELDS.keys())
    df.attrs["present_cols"] = present_cols

    df = _coerce_types(df)

    # Ensure invoice_id exists
    if "invoice_id" not in df.columns or df["invoice_id"].isna().all():
        df["invoice_id"] = [f"INV-{i+1:04d}" for i in range(len(df))]

    return df
