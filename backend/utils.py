def calculate_summary(df):
    total_invoices = len(df)
    block_count = (df["decision"] == "BLOCK").sum()
    review_count = (df["decision"] == "REVIEW").sum()
    approve_count = (df["decision"] == "APPROVE").sum()

    money_at_risk = df[df["decision"] == "BLOCK"]["invoice_amount"].sum()

    # Bug Fix: previously only counted BLOCK — REVIEW invoices are also flagged
    flagged_count = block_count + review_count

    return {
        "total_invoices": int(total_invoices),
        "approved": int(approve_count),
        "flagged_for_review": int(review_count),
        "blocked": int(block_count),
        "total_flagged": int(flagged_count),
        "money_at_risk": float(money_at_risk),
    }