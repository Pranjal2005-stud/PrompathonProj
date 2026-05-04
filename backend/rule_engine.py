def apply_rules(df):

    df["rule_flags"] = ""

    def add_flag(condition, label):
        df.loc[condition, "rule_flags"] += label + ", "

    add_flag(df["amount_vs_po"] > 1.3, "Overbilling")
    add_flag(df["quantity_vs_po"] > 1.5, "Quantity Mismatch")
    add_flag(df["missing_po"] == 1, "Missing PO")

    duplicates = df.duplicated(subset=["vendor_id", "invoice_amount", "invoice_date"], keep=False)
    if "is_duplicate" in df.columns:
        duplicates = duplicates | (df["is_duplicate"] == 1)
    add_flag(duplicates, "Duplicate Invoice")

    add_flag(df["amount_deviation"] > 0.7, "High Deviation")
    if "payment_ratio" in df.columns:
        add_flag(df["payment_ratio"] > 1.1, "Overpayment")

    df["rule_flags"] = df["rule_flags"].str.strip(", ")
    df["rule_flags"] = df["rule_flags"].replace("", "None")

    return df