import pandas as pd
import json

vendor_df = pd.read_csv("data/vendor_master.csv")

with open("data/price_benchmark.json") as f:
    benchmarks = json.load(f)


def validate_invoice(invoice):
    flags = []

    # vendor check
    vendor = invoice.get("vendor_name")
    if vendor not in vendor_df["name"].values:
        flags.append("Unknown Vendor")

    # price check
    item = invoice.get("item")

    if item in benchmarks:
        min_p, max_p = benchmarks[item]
        if invoice["invoice_amount"] > max_p:
            flags.append("Price Gouging")

    return flags