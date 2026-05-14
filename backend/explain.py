"""
explain.py
----------
Generates deduplicated, severity-ordered fraud explanations.
Used by /explain endpoint and as Groq fallback.
"""

from config import (
    CO_OCCURRENCE_HIGH,
    GRAPH_HIGH_DEGREE,
    GRAPH_PAGERANK_HIGH,
)


def explain_row(row: dict) -> list[str]:
    """
    Return a deduplicated list of explanation strings for one invoice.
    Ordered: collusion → splitting → financial → behavioral → fallback.
    """
    seen:    set[str]  = set()
    reasons: list[str] = []

    def add(msg: str) -> None:
        if msg not in seen:
            seen.add(msg)
            reasons.append(msg)

    flags = str(row.get("rule_flags", "") or "")
    risk  = float(row.get("risk_score", 0) or 0)

    # ── Collusion / network ───────────────────────────────────────────────────
    if row.get("shell_vendor_flag", 0):
        add("Vendor belongs to a suspicious shell vendor network.")
    if row.get("shared_bank_flag", 0):
        add("Multiple vendors share the same bank account.")
    if row.get("shared_gst_flag", 0):
        add("Multiple vendors share the same GST number.")
    if row.get("shared_address_flag", 0):
        add("Multiple vendors are registered at the same address.")
    if "Vendor Collusion" in flags:
        add("Vendor shows high graph connectivity with shared metadata — coordinated fraud.")

    # ── Split invoice / threshold ─────────────────────────────────────────────
    if row.get("split_cluster_flag", 0):
        add("Invoice splitting detected: multiple invoices clustered below approval threshold.")
    if "Threshold Avoidance" in flags:
        add("Cluster of invoices collectively exceeds approval threshold while each stays below it.")
    if "Threshold Hugging" in flags:
        add("Invoice amount is suspiciously close to the approval threshold (90–99.9%).")

    # ── Graph signals ─────────────────────────────────────────────────────────
    degree = float(row.get("vendor_degree", 0) or 0)
    if degree >= GRAPH_HIGH_DEGREE:
        add(f"Vendor has abnormal graph connectivity (degree={int(degree)}).")

    pagerank = float(row.get("pagerank", 0) or 0)
    if pagerank >= GRAPH_PAGERANK_HIGH:
        add(f"Vendor is central in the procurement risk network (PageRank={pagerank:.3f}).")

    co_occ = float(row.get("co_occurrence_score", 0) or 0)
    if co_occ >= CO_OCCURRENCE_HIGH:
        add("Suspicious repeated coordination patterns observed across vendors.")

    # ── Financial ─────────────────────────────────────────────────────────────
    if "Duplicate Invoice" in flags:
        add("Duplicate invoice: same vendor, amount, and date submitted more than once.")
    if "Overbilling" in flags:
        ratio = float(row.get("amount_vs_po", 1.0) or 1.0)
        add(f"Invoice is {ratio:.1f}× the approved PO amount — overbilling detected.")
    if "Overpayment" in flags:
        r = float(row.get("payment_ratio", 0) or 0)
        add(f"Payment ({r:.1f}× invoice value) exceeds invoice amount.")
    if "Extreme Deviation" in flags:
        add("Invoice amount is an extreme statistical outlier for this vendor.")
    if "High Deviation" in flags:
        add("Invoice amount significantly deviates from this vendor's historical average.")
    if "Overpriced vs Benchmark" in flags:
        add("Invoice exceeds market price benchmark for this item category.")
    if "First Invoice High Value" in flags:
        add("First-ever invoice from this vendor is unusually high — possible ghost vendor.")

    # ── Identity ──────────────────────────────────────────────────────────────
    if "Unknown Vendor" in flags:
        add("Vendor is not in the approved vendor master list.")
    if "Bank Account Mismatch" in flags:
        add("Payment bank account differs from the vendor's registered account.")

    # ── Behavioral ────────────────────────────────────────────────────────────
    if "Rapid Resubmission" in flags:
        add("Invoice resubmitted within 2 days of a previous submission.")
    if "Invoice Burst" in flags:
        add("4+ invoices submitted by the same vendor on the same day.")
    if "Payment Before Invoice" in flags:
        add("Payment processed before the invoice date — process control violation.")
    if "Weekend Invoice" in flags:
        add("Invoice submitted on a weekend — unusual for enterprise procurement.")
    if "Missing PO" in flags:
        add("No purchase order found for this invoice.")

    # ── ML-only anomaly ───────────────────────────────────────────────────────
    ml_score = float(row.get("ml_risk_score", 0) or 0)
    if ml_score > 70 and not reasons:
        add(f"ML model flagged this invoice as anomalous (ML score: {ml_score:.0f}/100).")

    # ── Fallback ──────────────────────────────────────────────────────────────
    if not reasons:
        if risk >= 45:
            add(f"Elevated risk score ({risk:.0f}/100) without specific rule triggers — review recommended.")
        else:
            add("No major fraud indicators detected. Invoice appears normal.")

    return reasons


def generate_explanations(df):
    df = df.copy()
    df["ai_explanation"] = df.apply(lambda row: explain_row(row.to_dict()), axis=1)
    return df


def explain_single(invoice: dict) -> str:
    """
    Plain-text explanation (~100–120 words) used as Groq fallback.
    """
    reasons    = explain_row(invoice)
    vendor     = invoice.get("vendor_name", "Unknown Vendor")
    risk       = float(invoice.get("risk_score", 0) or 0)
    decision   = invoice.get("decision", "REVIEW")
    fraud_type = invoice.get("fraud_type", "Unknown")
    top        = " ".join(reasons[:3])
    return (
        f"Invoice from {vendor} flagged with risk score {risk:.0f}/100 "
        f"and classified as {fraud_type}. Decision: {decision}. "
        f"{top} Immediate auditor review is recommended."
    )
