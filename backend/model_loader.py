"""
model_loader.py
---------------
Loads ML models from the models/ directory.
Tries multiple filename variants for robustness.
"""

import os
import pickle

BASE = os.path.dirname(__file__)
MODELS_DIR = os.path.join(BASE, "models")

# Candidate filenames for model and scaler
MODEL_CANDIDATES  = ["iforest.pkl", "anomaly_model.pkl", "xgb.pkl"]
SCALER_CANDIDATES = ["scaler (1).pkl", "scaler.pkl", "scaler_v2.pkl"]


def _load_pkl(candidates: list) -> object:
    for name in candidates:
        path = os.path.join(MODELS_DIR, name)
        if os.path.exists(path):
            with open(path, "rb") as f:
                obj = pickle.load(f)
            print(f"[model_loader] Loaded: {name}")
            return obj
    return None


def load_model():
    model  = _load_pkl(MODEL_CANDIDATES)
    scaler = _load_pkl(SCALER_CANDIDATES)

    if model is None:
        print("[model_loader] No model file found — rule-only mode active.")
    if scaler is None:
        print("[model_loader] No scaler file found — ML scoring disabled.")

    return model, scaler
