"""
data_loader.py
--------------
Loads static reference data: vendor master and price benchmark.
Returns empty structures gracefully if files are missing.
"""

import os
import json
import pandas as pd

BASE = os.path.dirname(__file__)
DATA_DIR = os.path.join(BASE, "data")


def load_vendor_master() -> pd.DataFrame:
    path = os.path.join(DATA_DIR, "vendor_master.csv")
    try:
        df = pd.read_csv(path)
        df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
        return df
    except Exception as e:
        print(f"[data_loader] vendor_master not loaded: {e}")
        return pd.DataFrame(columns=["vendor_name"])


def load_price_benchmark() -> dict:
    path = os.path.join(DATA_DIR, "price_benchmark.json")
    try:
        with open(path, "r") as f:
            return json.load(f)
    except Exception as e:
        print(f"[data_loader] price_benchmark not loaded: {e}")
        return {}
