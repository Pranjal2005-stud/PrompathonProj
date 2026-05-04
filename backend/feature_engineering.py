import pandas as pd


def compute_features(df):

    # -------- SAFETY: ensure required columns exist --------
    if "vendor_id" not in df.columns:
        df["vendor_id"] = "unknown"

    for col in [
        "invoice_amount", "approved_amount_po", "quantity", "approved_quantity_po",
        "paid_amount", "invoice_date"
    ]:
        if col not in df.columns:
            df[col] = 0

    # -------- FIX: date handling --------
    df["invoice_date"] = pd.to_datetime(df["invoice_date"], errors="coerce")

    # -------- FEATURES --------

    # Vendor avg amount
    df["vendor_avg_amount"] = df.groupby("vendor_id")["invoice_amount"].transform("mean")

    # Amount deviation from vendor average
    df["amount_deviation"] = (
        abs(df["invoice_amount"] - df["vendor_avg_amount"]) / (df["vendor_avg_amount"] + 1)
    )

    # Invoice amount vs approved PO amount
    df["amount_vs_po"] = df["invoice_amount"] / (df["approved_amount_po"] + 1)

    # Quantity vs approved PO quantity
    df["quantity_vs_po"] = df["quantity"] / (df["approved_quantity_po"] + 1)

    # Missing PO flag — only flag if column was actually present and is NaN/0
    if "approved_amount_po" in df.columns:
        df["missing_po"] = (df["approved_amount_po"].isna() | (df["approved_amount_po"] == 0)).astype(int)
    else:
        df["missing_po"] = 0

    # -------- FIX: duplicate features --------
    df["duplicate_pattern"] = df.duplicated(
        subset=["vendor_id", "invoice_amount", "invoice_date"],
        keep=False
    ).astype(int)

    df["is_duplicate"] = df["duplicate_pattern"]

    # High amount flag
    df["high_amount_flag"] = (df["invoice_amount"] > df["vendor_avg_amount"] * 2).astype(int)

    # Payment ratio
    df["payment_ratio"] = df["paid_amount"] / (df["invoice_amount"] + 1)

    # Vendor invoice count
    df["vendor_invoice_count"] = df.groupby("vendor_id")["invoice_amount"].transform("count")

    # -------- FIX: days_since_last_invoice --------
    df = df.sort_values(by=["vendor_id", "invoice_date"])

    df["days_since_last_invoice"] = (
        df.groupby("vendor_id")["invoice_date"].diff().dt.days
    )

    df["days_since_last_invoice"] = df["days_since_last_invoice"].fillna(0)
    
    df["extreme_deviation"] = (df["amount_deviation"] > 1.5).astype(int)

    df["overpayment_flag"] = (df["payment_ratio"] > 1.1).astype(int)

    df["underbilling_flag"] = (df["amount_vs_po"] < 0.7).astype(int)

    return df