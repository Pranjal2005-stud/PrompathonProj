"""
schema_normalizer.py
--------------------
Converts ANY uploaded invoice DataFrame into the canonical internal schema.
Uses alias mapping → fuzzy matching in that priority order.

Key fix: tracks which columns were ACTUALLY present in the raw upload
so downstream logic can distinguish "column absent" from "column present but zero".
"""

import re
import pandas as pd
from typing import Optional, Set
from difflib import get_close_matches
from canonical_schema import CANONICAL_FIELDS

ALIAS_MAP = {
    # invoice_id
    "invoice_id": "invoice_id", "inv_id": "invoice_id", "invoice_no": "invoice_id",
    "invoice_number": "invoice_id", "bill_no": "invoice_id", "bill_number": "invoice_id",
    "doc_no": "invoice_id", "document_number": "invoice_id", "ref_no": "invoice_id",

    # vendor_id
    "vendor_id": "vendor_id", "supplier_id": "vendor_id", "vendor_code": "vendor_id",
    "supplier_code": "vendor_id",

    # vendor_name
    "vendor_name": "vendor_name", "vendor": "vendor_name", "supplier": "vendor_name",
    "supplier_name": "vendor_name", "company": "vendor_name", "party_name": "vendor_name",
    "billed_by": "vendor_name", "seller": "vendor_name",

    # invoice_amount
    "invoice_amount": "invoice_amount", "amount": "invoice_amount",
    "total": "invoice_amount", "total_amount": "invoice_amount",
    "bill_total": "invoice_amount", "total_value": "invoice_amount",
    "invoice_amt": "invoice_amount", "inv_amount": "invoice_amount",
    "gross_amount": "invoice_amount", "net_amount": "invoice_amount",
    "payable": "invoice_amount", "total_payable": "invoice_amount",
    "invoice_value": "invoice_amount", "value": "invoice_amount",

    # approved_amount_po
    "approved_amount_po": "approved_amount_po", "po_amount": "approved_amount_po",
    "purchase_order_amount": "approved_amount_po", "po_value": "approved_amount_po",
    "approved_amount": "approved_amount_po", "sanctioned_amount": "approved_amount_po",
    "budgeted_amount": "approved_amount_po",

    # paid_amount
    "paid_amount": "paid_amount", "amount_paid": "paid_amount",
    "payment_made": "paid_amount", "paid": "paid_amount",
    "cleared_amount": "paid_amount",

    # unit_price
    "unit_price": "unit_price", "price": "unit_price", "rate": "unit_price",
    "unit_rate": "unit_price", "cost_per_unit": "unit_price",

    # quantity
    "quantity": "quantity", "qty": "quantity", "units": "quantity",
    "no_of_units": "quantity", "count": "quantity", "nos": "quantity",

    # approved_quantity_po
    "approved_quantity_po": "approved_quantity_po", "po_quantity": "approved_quantity_po",
    "approved_qty": "approved_quantity_po", "sanctioned_qty": "approved_quantity_po",

    # invoice_date
    "invoice_date": "invoice_date", "date": "invoice_date", "bill_date": "invoice_date",
    "invoice_dt": "invoice_date", "billing_date": "invoice_date",
    "transaction_date": "invoice_date", "doc_date": "invoice_date",

    # item_name
    "item_name": "item_name", "item": "item_name", "description": "item_name",
    "product": "item_name", "service": "item_name", "goods": "item_name",
    "particulars": "item_name", "details": "item_name",
}

CANONICAL_NAMES = list(CANONICAL_FIELDS.keys())


def _clean_col(col: str) -> str:
    return re.sub(r"[\s\-]+", "_", col.strip().lower())


def _fuzzy_match(col: str, threshold: float = 0.75) -> Optional[str]:
    matches = get_close_matches(col, CANONICAL_NAMES, n=1, cutoff=threshold)
    return matches[0] if matches else None


def _get_present_canonical_cols(raw_cols) -> Set[str]:
    """
    Returns the set of canonical column names that were actually present
    in the raw upload (before defaults are added).
    """
    present = set()
    for raw_col in raw_cols:
        cleaned = _clean_col(raw_col)
        if cleaned in ALIAS_MAP:
            present.add(ALIAS_MAP[cleaned])
        else:
            fuzzy = _fuzzy_match(cleaned)
            if fuzzy:
                present.add(fuzzy)
    return present


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    rename_map = {}
    for raw_col in df.columns:
        cleaned = _clean_col(raw_col)
        if cleaned in ALIAS_MAP:
            rename_map[raw_col] = ALIAS_MAP[cleaned]
            continue
        fuzzy = _fuzzy_match(cleaned)
        if fuzzy:
            rename_map[raw_col] = fuzzy
            continue
        rename_map[raw_col] = cleaned

    df = df.rename(columns=rename_map)

    # De-duplicate mapped columns — keep first, fill nulls from second
    seen = {}
    drop_cols = []
    for col in df.columns:
        if col in CANONICAL_NAMES:
            if col in seen:
                df[seen[col]] = df[seen[col]].combine_first(df[col])
                drop_cols.append(col)
            else:
                seen[col] = col
    df = df.drop(columns=drop_cols, errors="ignore")
    return df


def to_canonical(df: pd.DataFrame) -> pd.DataFrame:
    """
    Normalize columns and enforce canonical schema.
    Also attaches _present_cols metadata so feature_engineering
    knows which fields were actually uploaded vs defaulted.
    """
    # Record which canonical columns were present BEFORE adding defaults
    present_cols = _get_present_canonical_cols(df.columns)

    df = normalize_columns(df)

    for field, (dtype, default) in CANONICAL_FIELDS.items():
        if field not in df.columns:
            df[field] = default
        else:
            try:
                if dtype == float:
                    df[field] = pd.to_numeric(df[field], errors="coerce").fillna(default or 0.0)
                elif dtype == str:
                    df[field] = df[field].astype(str).replace("nan", None).replace("None", None)
            except Exception:
                df[field] = default

    # vendor_id fallback to vendor_name
    mask = df["vendor_id"].isna() | (df["vendor_id"] == "unknown") | (df["vendor_id"] == "None")
    df.loc[mask, "vendor_id"] = df.loc[mask, "vendor_name"]

    df["invoice_date"] = pd.to_datetime(df["invoice_date"], errors="coerce")

    # Attach presence metadata as a DataFrame attribute
    # This tells feature_engineering which columns were actually uploaded
    df.attrs["present_cols"] = present_cols

    return df
