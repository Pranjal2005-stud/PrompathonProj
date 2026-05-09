def map_to_model_features(raw_invoice):
    mapped = {}

    # flexible mapping
    mapped["invoice_amount"] = raw_invoice.get("invoice_amount") or raw_invoice.get("amount")

    mapped["quantity"] = raw_invoice.get("quantity", 1)

    mapped["approved_amount"] = raw_invoice.get("approved_amount", mapped["invoice_amount"])

    mapped["amount_vs_po"] = (
        mapped["invoice_amount"] / mapped["approved_amount"]
        if mapped["approved_amount"] else 1
    )

    mapped["quantity_vs_po"] = 1

    mapped["missing_po"] = 1 if "approved_amount" not in raw_invoice else 0

    mapped["high_amount_flag"] = 1 if mapped["invoice_amount"] > 50000 else 0

    mapped["payment_ratio"] = 1

    mapped["duplicate_pattern"] = 0

    mapped["days_since_last_invoice"] = 0

    return mapped