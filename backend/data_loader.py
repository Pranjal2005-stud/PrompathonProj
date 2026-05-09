import pandas as pd
import json
import os

_base = os.path.dirname(os.path.abspath(__file__))

# -------- Load Vendor Master --------
def load_vendor_master():
    try:
        df = pd.read_csv(os.path.join(_base, "data", "vendor_master.csv"))
        df.columns = df.columns.str.strip().str.lower()  # normalize to lowercase
        return df
    except Exception as e:
        print("Error loading vendor master:", e)
        return pd.DataFrame()

# -------- Load Price Benchmark --------
def load_price_benchmark():
    try:
        with open(os.path.join(_base, "data", "price_benchmark.json"), "r") as f:
            return json.load(f)
    except Exception as e:
        print("Error loading price benchmark:", e)
        return {}