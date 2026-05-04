from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd

from feature_engineering import compute_features
from predict import get_prediction
from model_loader import load_model
from utils import calculate_summary

model, scaler = None, None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global model, scaler
    model, scaler = load_model()
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"status": "running"}


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    df = pd.read_csv(file.file)

    # Compute engineered features
    df = compute_features(df)

    # Run ML scoring + rule-based decisions (reason is set inside get_prediction)
    df = get_prediction(df, model, scaler)

    # Return first 50 rows
    return df.head(50).to_dict(orient="records")


@app.post("/summary")
async def summary(file: UploadFile = File(...)):
    df = pd.read_csv(file.file)
    df = compute_features(df)
    df = get_prediction(df, model, scaler)
    return calculate_summary(df)