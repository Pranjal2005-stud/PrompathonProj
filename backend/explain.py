"""
explain.py
----------
Generates structured fraud explanations for each invoice.
Used by the /explain endpoint and as a fallback when Groq is unavailable.

Always returns at least one explanation per invoice.
Uses graph signals, split invoice signals, collusion signals, and centrality.
"""

import pandas as pd
from config import (
    CO_OCCURRENCE_HIGH,
    GRAPH_HIGH_DEGREE,
    GRAPH_BETWEENNESS_HIGH,
    GRAPH_PAGERANK_HIGH,
)


def _explain_row(row: dict) -> list[str]:
    """
    Build a list of human-readable explanation strings for a single invoice row.
    Returns at least one string.
    """
    reasons: list[str] = []
    flags = str(row.get("rule_flags", "") or "")
    risk  = float(row.get("risk_score", 0) or 0)

    # ── Shell vendor / collusion signals ──────────────────────────────────────
    if row.get("shell_vendor_flag", 0) == 1:
        reasons.append("Vendor belongs to a highly connected procurement cluster (shell vendor signal).")

    if row.get("shared_bank_flag", 0) == 1:
        reasons.append("Multiple vendors share the same bank account — strong collusion indicator.")

    if row.get("shared_gst_flag", 0) == 1:
        reasons.append("Multiple vendors share the same GSTIN — possible shell company network.")

    if row.get("shared_address_flag", 0) == 1:
        reasons.append("Multiple vendors registered at the same address.")

    if "Vendor Collusion" in flags:
        reasons.append("Vendor shows high graph connectivity combined with shared metadata — coordinated fraud pattern.")

    # ── Split invoice / threshold avoidance ───────────────────────────────────
    if row.get("split_cluster_flag", 0) == 1:
        reasons.append("Invoice splitting behavior detected: multiple invoices clustered below approval threshold.")

    if "Threshold Avoidance" in flags:
        reasons.append("Cluster of invoices collectively exceeds approval threshold while each stays just below it.")

    if "Threshold Hugging" in flags:
        reasons.append("Invoice amount is suspiciously close to the approval threshold (90–99.9%).")

    # ── Graph / network signals ───────────────────────────────────────────────
    degree = float(row.get("vendor_degree", 0) or 0)
    if degree >= GRAPH_HIGH_DEGREE:
        reasons.append(f"Vendor has abnormal graph connectivity (degree={int(degree)}) — appears in multiple suspicious clusters.")

    betweenness = float(row.get("betweenness_centrality", 0) or 0)
    if betweenness >= GRAPH_BETWEENNESS_HIGH:
        reasons.append(f"Unusual graph centrality detected (betweenness={betweenness:.3f}) — vendor acts as a bridge in the fraud network.")

    pagerank = float(row.get("pagerank", 0) or 0)
    if pagerank >= GRAPH_PAGERANK_HIGH:
        reasons.append(f"High PageRank score ({pagerank:.3f}) — vendor is central to the procurement risk network.")

    co_occ = float(row.get("co_occurrence_score", 0) or 0)
    if co_occ >= CO_OCCURRENCE_HIGH:
        reasons.append("Suspicious repeated coordination patterns observed across multiple vendors.")

    # ── Financial signals ─────────────────────────────────────────────────────
    if "Duplicate Invoice" in flags:
        reasons.append("Duplicate invoice detected — same vendor, amount, and date submitted more than once.")

    if "Overbilling" in flags:
        amt_vs_po = float(row.get("amount_vs_po", 1.0) or 1.0)
        reasons.append(f"Invoice amount is {amt_vs_po:.1f}x the approved PO amount — overbilling detected.")

    if "Overpayment" in flags:
        ratio = float(row.get("payment_ratio", 0) or 0)
        reasons.append(f"Payment ({ratio:.1f}x invoice) exceeds invoice value — overpayment risk.")

    if "Extreme Deviation" in flags:
        reasons.append("Invoice amount is an extreme statistical outlier for this vendor.")

    if "High Deviation" in flags:
        reasons.append("Invoice amount significantly deviates from this vendor's historical average.")

    if "Overpriced vs Benchmark" in flags:
        reasons.append("Invoice amount exceeds market price benchmark for this item category.")

    if "First Invoice High Value" in flags:
        reasons.append("First-ever invoice from this vendor is unusually high — possible ghost vendor.")

    # ── Identity signals ──────────────────────────────────────────────────────
    if "Unknown Vendor" in flags:
        reasons.append("Vendor is not registered in the approved vendor master list.")

    if "Bank Account Mismatch" in flags:
        reasons.append("Payment bank account differs from the vendor's registered account — possible fraud redirection.")

    # ── Behavioral signals ────────────────────────────────────────────────────
    if "Rapid Resubmission" in flags:
        reasons.append("Invoice resubmitted within 2 days of a previous submission from the same vendor.")

    if "Invoice Burst" in flags:
        reasons.append("4 or more invoices submitted by the same vendor on the same day.")

    if "Payment Before Invoice" in flags:
        reasons.append("Payment was processed before the invoice date — process control violation.")

    if "Weekend Invoice" in flags:
        reasons.append("Invoice submitted on a weekend — unusual for enterprise procurement.")

    if "Missing PO" in flags:
        reasons.append("No purchase order found for this invoice — mandatory in enterprise procurement.")

    # ── ML-only anomaly ───────────────────────────────────────────────────────
    ml_score = float(row.get("ml_risk_score", 0) or 0)
    if ml_score > 70 and not reasons:
        reasons.append(f"ML model flagged this invoice as anomalous (ML score: {ml_score:.0f}/100).")

    # ── Fallback ──────────────────────────────────────────────────────────────
    if not reasons:
        if risk >= 45:
            reasons.append(f"Invoice shows elevated risk score ({risk:.0f}/100) without specific rule triggers — review recommended.")
        else:
            reasons.append("No major fraud indicators detected. Invoice appears normal.")

    return reasons


def generate_explanations(df: pd.DataFrame) -> pd.DataFrame:
    """
    Add an 'ai_explanation' column to the DataFrame.
    Each cell contains a list of explanation strings.
    """
    df = df.copy()
    df["ai_explanation"] = df.apply(
        lambda row: _explain_row(row.to_dict()), axis=1
    )
    return df


def explain_single(invoice: dict) -> str:
    """
    Generate a plain-text explanation for a single invoice dict.
    Used as a fallback when Groq API is unavailable.
    Returns a concise paragraph (100–120 words).
    """
    reasons = _explain_row(invoice)
    fraud_type = invoice.get("fraud_type", "Unknown")
    risk       = float(invoice.get("risk_score", 0) or 0)
    decision   = invoice.get("decision", "REVIEW")
    vendor     = invoice.get("vendor_name", "Unknown Vendor")

    top_reasons = reasons[:3]
    body = " ".join(top_reasons)

    return (
        f"Invoice from {vendor} has been flagged with a risk score of {risk:.0f}/100 "
        f"and classified as {fraud_type}. Decision: {decision}. "
        f"{body} "
        f"Immediate auditor review is recommended."
    )
