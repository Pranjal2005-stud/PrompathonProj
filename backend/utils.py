def calculate_summary(df):

    total_invoices = len(df)
    fraud_count = (df["decision"] == "BLOCK").sum()

    money_saved = df[df["decision"] == "BLOCK"]["invoice_amount"].sum()

    return {
        "total_invoices": int(total_invoices),
        "fraud_detected": int(fraud_count),
        "money_saved": float(money_saved)
    }