"""
invoice_parser.py
-----------------
Parses uploaded CSV/Excel files into a canonical DataFrame.

Key guarantees:
  - vendor_id is NEVER collapsed to "unknown" when vendor_name is present
  - All common column name variants are mapped to canonical names
  - Graph metadata columns (bank_account, gst_number, vendor_address) are
    mapped from their many real-world aliases
  - parse_diagnostics() returns a full column mapping report
"""

import io
import logging

import pandas as pd
from fastapi import UploadFile

from canonical_schema import CANONICAL_FIELDS

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Exhaustive alias map  →  canonical name
# Every key is already lowercased + underscored.
# ---------------------------------------------------------------------------
ALIASES: dict[str, str] = {
    # ── invoice_id ────────────────────────────────────────────────────────────
    "id":                       "invoice_id",
    "invoice_no":               "invoice_id",
    "invoice_number":           "invoice_id",
    "inv_id":                   "invoice_id",
    "inv_no":                   "invoice_id",
    "bill_no":                  "invoice_id",
    "bill_number":              "invoice_id",
    "doc_id":                   "invoice_id",
    "document_id":              "invoice_id",
    "ref_no":                   "invoice_id",
    "reference_number":         "invoice_id",

    # ── vendor_name ───────────────────────────────────────────────────────────
    "vendor":                   "vendor_name",
    "vendor_nm":                "vendor_name",
    "supplier_name":            "vendor_name",
    "supplier":                 "vendor_name",
    "company_name":             "vendor_name",
    "company":                  "vendor_name",
    "party_name":               "vendor_name",
    "party":                    "vendor_name",
    "payee":                    "vendor_name",
    "payee_name":               "vendor_name",
    "contractor":               "vendor_name",
    "contractor_name":          "vendor_name",
    "firm_name":                "vendor_name",
    "firm":                     "vendor_name",

    # ── vendor_id ─────────────────────────────────────────────────────────────
    "vendor_code":              "vendor_id",
    "vendor_no":                "vendor_id",
    "supplier_id":              "vendor_id",
    "supplier_code":            "vendor_id",
    "party_id":                 "vendor_id",
    "party_code":               "vendor_id",
    "payee_id":                 "vendor_id",
    "contractor_id":            "vendor_id",
    "company_id":               "vendor_id",

    # ── invoice_amount ────────────────────────────────────────────────────────
    "amount":                   "invoice_amount",
    "total_amount":             "invoice_amount",
    "invoice_total":            "invoice_amount",
    "total":                    "invoice_amount",
    "bill_amount":              "invoice_amount",
    "gross_amount":             "invoice_amount",
    "net_amount":               "invoice_amount",
    "value":                    "invoice_amount",
    "invoice_value":            "invoice_amount",
    "txn_amount":               "invoice_amount",
    "transaction_amount":       "invoice_amount",

    # ── approved_amount_po ────────────────────────────────────────────────────
    "po_amount":                "approved_amount_po",
    "po_approved_amount":       "approved_amount_po",
    "approved_amount":          "approved_amount_po",
    "purchase_order_amount":    "approved_amount_po",
    "po_value":                 "approved_amount_po",
    "sanctioned_amount":        "approved_amount_po",
    "budget_amount":            "approved_amount_po",

    # ── paid_amount ───────────────────────────────────────────────────────────
    "payment":                  "paid_amount",
    "amount_paid":              "paid_amount",
    "payment_amount":           "paid_amount",
    "paid":                     "paid_amount",
    "disbursed_amount":         "paid_amount",
    "released_amount":          "paid_amount",

    # ── quantity ──────────────────────────────────────────────────────────────
    "qty":                      "quantity",
    "invoice_qty":              "quantity",
    "units":                    "quantity",
    "no_of_units":              "quantity",
    "nos":                      "quantity",

    # ── approved_quantity_po ──────────────────────────────────────────────────
    "po_qty":                   "approved_quantity_po",
    "approved_qty":             "approved_quantity_po",
    "sanctioned_qty":           "approved_quantity_po",

    # ── unit_price ────────────────────────────────────────────────────────────
    "price":                    "unit_price",
    "rate":                     "unit_price",
    "unit_rate":                "unit_price",
    "per_unit_price":           "unit_price",

    # ── invoice_date ──────────────────────────────────────────────────────────
    "date":                     "invoice_date",
    "inv_date":                 "invoice_date",
    "bill_date":                "invoice_date",
    "transaction_date":         "invoice_date",
    "txn_date":                 "invoice_date",
    "doc_date":                 "invoice_date",
    "payment_date":             "invoice_date",
    "issue_date":               "invoice_date",

    # ── item_name ─────────────────────────────────────────────────────────────
    "item":                     "item_name",
    "description":              "item_name",
    "product":                  "item_name",
    "service":                  "item_name",
    "goods":                    "item_name",
    "material":                 "item_name",
    "particulars":              "item_name",

    # ── bank_account  ← THE CRITICAL MISSING ALIASES ─────────────────────────
    "bank":                     "bank_account",
    "bank_acc":                 "bank_account",
    "bank_acc_no":              "bank_account",
    "bank_account_no":          "bank_account",
    "bank_account_number":      "bank_account",
    "account_no":               "bank_account",
    "account_number":           "bank_account",
    "acc_no":                   "bank_account",
    "acc_number":               "bank_account",
    "payment_account":          "bank_account",
    "beneficiary_account":      "bank_account",
    "ifsc":                     "bank_account",   # treat IFSC as bank proxy

    # ── gst_number  ← THE CRITICAL MISSING ALIASES ───────────────────────────
    "gst_id":                   "gst_number",
    "gst_no":                   "gst_number",
    "gstin":                    "gst_number",
    "gst":                      "gst_number",
    "gst_registration":         "gst_number",
    "gst_reg_no":               "gst_number",
    "tax_id":                   "gst_number",
    "tax_number":               "gst_number",
    "vat_number":               "gst_number",
    "tin":                      "gst_number",
    "pan":                      "gst_number",   # PAN is a proxy for GST identity

    # ── vendor_address  ← THE CRITICAL MISSING ALIASES ───────────────────────
    "address":                  "vendor_address",
    "vendor_addr":              "vendor_address",
    "supplier_address":         "vendor_address",
    "company_address":          "vendor_address",
    "registered_address":       "vendor_address",
    "office_address":           "vendor_address",
    "billing_address":          "vendor_address",
    "city":                     "vendor_address",   # city as address proxy
    "location":                 "vendor_address",
    "state":                    "vendor_address",
    "pincode":                  "vendor_address",
    "zip":                      "vendor_address",
}


# ---------------------------------------------------------------------------
# Column normalisation
# ---------------------------------------------------------------------------

def _normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Lowercase + strip column names, then apply aliases."""
    df.columns = [str(c).strip().lower().replace(" ", "_").replace("-", "_")
                  for c in df.columns]
    df = df.rename(columns={k: v for k, v in ALIASES.items() if k in df.columns})
    return df


# ---------------------------------------------------------------------------
# Type coercion
# ---------------------------------------------------------------------------

def _coerce_types(df: pd.DataFrame) -> pd.DataFrame:
    """Coerce each canonical field to its declared type."""
    for field, (typ, default) in CANONICAL_FIELDS.items():
        if field not in df.columns:
            df[field] = default
            continue
        if typ == float:
            df[field] = pd.to_numeric(df[field], errors="coerce").fillna(default or 0.0)
        elif typ == str:
            df[field] = (
                df[field]
                .astype(str)
                .str.strip()
                .replace({"nan": None, "None": None, "NaN": None, "": None})
            )
    return df


# ---------------------------------------------------------------------------
# vendor_id fallback — NEVER collapse to "unknown"
# ---------------------------------------------------------------------------

def _ensure_vendor_id(df: pd.DataFrame) -> pd.DataFrame:
    """
    Guarantee every row has a meaningful vendor_id.

    Priority:
      1. vendor_id column (if present and non-null)
      2. vendor_name column (if present and non-null)
      3. Synthesised from invoice_id  (e.g. "vendor_INV-0001")
      4. Row-index fallback           (e.g. "vendor_row_0")

    This prevents the entire dataset collapsing to vendor_id = "unknown".
    """
    if "vendor_id" not in df.columns:
        df["vendor_id"] = None

    # Fill nulls from vendor_name first
    if "vendor_name" in df.columns:
        mask = (
            df["vendor_id"].isna() |
            (df["vendor_id"].astype(str).str.strip().str.lower().isin(
                {"unknown", "nan", "none", "null", ""}
            ))
        )
        # Only copy vendor_name if it is itself meaningful
        vname = df["vendor_name"].astype(str).str.strip()
        good_name = ~vname.str.lower().isin({"unknown", "nan", "none", "null", ""})
        df.loc[mask & good_name, "vendor_id"] = vname[mask & good_name]

    # Fill remaining nulls from invoice_id
    if "invoice_id" in df.columns:
        mask = (
            df["vendor_id"].isna() |
            (df["vendor_id"].astype(str).str.strip().str.lower().isin(
                {"unknown", "nan", "none", "null", ""}
            ))
        )
        df.loc[mask, "vendor_id"] = "vendor_" + df.loc[mask, "invoice_id"].astype(str)

    # Final fallback: row index — guaranteed unique, never "unknown"
    mask = (
        df["vendor_id"].isna() |
        (df["vendor_id"].astype(str).str.strip().str.lower().isin(
            {"unknown", "nan", "none", "null", "", "vendor_none"}
        ))
    )
    if mask.any():
        df.loc[mask, "vendor_id"] = [f"vendor_row_{i}" for i in df.index[mask]]

    df["vendor_id"] = df["vendor_id"].astype(str).str.strip()
    return df


# ---------------------------------------------------------------------------
# vendor_name fallback
# ---------------------------------------------------------------------------

def _ensure_vendor_name(df: pd.DataFrame) -> pd.DataFrame:
    """If vendor_name is missing/unknown, copy from vendor_id."""
    if "vendor_name" not in df.columns:
        df["vendor_name"] = df["vendor_id"]
        return df

    mask = (
        df["vendor_name"].isna() |
        (df["vendor_name"].astype(str).str.strip().str.lower().isin({"unknown", "nan", "none", ""}))
    )
    df.loc[mask, "vendor_name"] = df.loc[mask, "vendor_id"]
    return df


# ---------------------------------------------------------------------------
# Public: parse_input
# ---------------------------------------------------------------------------

async def parse_input(file: UploadFile) -> pd.DataFrame:
    """Read uploaded file (CSV or Excel) and return normalised DataFrame."""
    content = await file.read()
    name    = (file.filename or "").lower()

    if name.endswith((".xlsx", ".xls")):
        df = pd.read_excel(io.BytesIO(content))
    else:
        for enc in ("utf-8", "latin-1", "cp1252"):
            try:
                df = pd.read_csv(io.BytesIO(content), encoding=enc)
                break
            except UnicodeDecodeError:
                continue
        else:
            df = pd.read_csv(io.BytesIO(content), encoding="utf-8", errors="replace")

    raw_columns = list(df.columns)
    df = _normalize_columns(df)

    # Track which canonical columns were present before filling defaults
    present_cols = set(df.columns) & set(CANONICAL_FIELDS.keys())
    df.attrs["present_cols"] = present_cols

    df = _coerce_types(df)
    df = _ensure_vendor_id(df)
    df = _ensure_vendor_name(df)

    # Ensure invoice_id exists
    if "invoice_id" not in df.columns or df["invoice_id"].isna().all():
        df["invoice_id"] = [f"INV-{i+1:04d}" for i in range(len(df))]

    unique_vendors = df["vendor_id"].nunique()
    log.info(
        "[parser] %s → %d rows | %d unique vendors | cols: %s",
        file.filename, len(df), unique_vendors,
        list(df.columns),
    )

    if unique_vendors == 1 and len(df) > 5:
        log.warning(
            "[parser] WARNING: only 1 unique vendor detected. "
            "Raw columns were: %s. Check ALIASES map.", raw_columns
        )

    return df


# ---------------------------------------------------------------------------
# Public: parse_diagnostics  (used by /upload/diagnostics endpoint)
# ---------------------------------------------------------------------------

def parse_diagnostics(df_raw: pd.DataFrame) -> dict:
    """
    Given the raw (pre-normalised) DataFrame, return a full column mapping report.
    """
    raw_cols = [str(c).strip().lower().replace(" ", "_").replace("-", "_")
                for c in df_raw.columns]

    mapped:   dict[str, str] = {}
    unmapped: list[str]      = []

    for col in raw_cols:
        if col in ALIASES:
            mapped[col] = ALIASES[col]
        elif col in CANONICAL_FIELDS:
            mapped[col] = col   # already canonical
        else:
            unmapped.append(col)

    canonical_present = set(mapped.values())
    canonical_missing = [
        f for f in CANONICAL_FIELDS
        if f not in canonical_present
    ]
    critical_missing = [
        f for f in ("invoice_amount", "vendor_name", "invoice_date")
        if f not in canonical_present
    ]

    return {
        "raw_columns":        list(df_raw.columns),
        "mapped_columns":     mapped,
        "unmapped_columns":   unmapped,
        "canonical_present":  sorted(canonical_present),
        "canonical_missing":  canonical_missing,
        "critical_missing":   critical_missing,
        "can_process":        len(critical_missing) == 0,
    }
