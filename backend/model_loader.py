import os
import pickle


def load_model():
    base_dir = os.path.dirname(__file__)

    model_path = os.path.join(base_dir, "models", "anomaly_model.pkl")
    scaler_path = os.path.join(base_dir, "models", "scaler.pkl")

    try:
        with open(model_path, "rb") as f:
            model = pickle.load(f)
        with open(scaler_path, "rb") as f:
            scaler = pickle.load(f)
        print("Model and scaler loaded successfully.")
        return model, scaler
    except FileNotFoundError as e:
        print(f"Model file not found: {e}. Predictions will use random fallback scores.")
        return None, None
    except Exception as e:
        print(f"Failed to load model: {e}. Predictions will use random fallback scores.")
        return None, None