"""
app.py
------
FastAPI entry point.
Pipeline: parse_input → to_canonical → compute_features → get_prediction → sanitize → respond
"""

import math
import os
import numpy as np
import pandas as pd
import requests
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

# Groq model — llama3-70b-8192 was deprecated, use llama-3.3-70b-versatile
GROQ_MODEL = "llama-3.3-70b-versatile"

from invoice_parser import parse_input
from feature_engineering import compute_features
from predict import get_prediction
from model_loader import load_model
from utils import calculate_summary

model, scaler = None, None


# ── JSON sanitizer ────────────────────────────────────────────────────────────
def sanitize(df: pd.DataFrame) -> list:
    def clean(v):
        if v is None:
            return None
        if isinstance(v, np.integer):
            return int(v)
        if isinstance(v, (np.floating, float)):
            f = float(v)
            return None if (math.isnan(f) or math.isinf(f)) else f
        if isinstance(v, np.bool_):
            return bool(v)
        if isinstance(v, pd.Timestamp):
            return str(v.date()) if not pd.isnull(v) else None
        return v
    return [{k: clean(v) for k, v in row.items()} for row in df.to_dict(orient="records")]


def _groq_call(prompt: str, max_tokens: int = 200) -> str:
    """Shared Groq API call with proper error handling."""
    if not GROQ_API_KEY:
        return "Groq API key not configured. Add GROQ_API_KEY to backend/.env"
    res = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": GROQ_MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.4,
            "max_tokens": max_tokens,
        },
        timeout=25,
    )
    res.raise_for_status()
    return res.json()["choices"][0]["message"]["content"].strip()


# ── Lifespan ──────────────────────────────────────────────────────────────────
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


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"status": "running", "model_loaded": model is not None}


# ── Predict ───────────────────────────────────────────────────────────────────
@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    df = parse_input(file)
    df = compute_features(df)
    df = get_prediction(df, model, scaler)
    return sanitize(df)


# ── Summary ───────────────────────────────────────────────────────────────────
@app.post("/summary")
async def summary(file: UploadFile = File(...)):
    df = parse_input(file)
    df = compute_features(df)
    df = get_prediction(df, model, scaler)
    return calculate_summary(df)


# ── AI Copilot ────────────────────────────────────────────────────────────────
class CopilotRequest(BaseModel):
    question: str
    context: str = ""


@app.post("/copilot")
def copilot(req: CopilotRequest):
    prompt = f"""You are an AI Fraud Auditor for a procurement platform.
Context: {req.context}
Question: {req.question}
Answer in 3-4 sentences. Be specific with numbers and vendor names. Focus on fraud indicators and one actionable recommendation."""
    try:
        return {"answer": _groq_call(prompt, max_tokens=180)}
    except Exception as e:
        return {"answer": f"AI analysis unavailable: {e}"}


# ── Invoice-level AI Explanation ──────────────────────────────────────────────
class ExplainRequest(BaseModel):
    invoice: dict


@app.post("/explain")
def explain(req: ExplainRequest):
    inv = req.invoice
    prompt = f"""You are a procurement fraud auditor. Analyze this invoice in 4-5 sentences.
Vendor: {inv.get('vendor_name')} | Amount: ₹{inv.get('invoice_amount')} | Decision: {inv.get('decision')} | Risk: {inv.get('risk_score', 0):.1f}/100
Flags: {inv.get('reason', 'None')} | Rule Score: {inv.get('rule_score', 0):.0f} | ML Score: {inv.get('ml_risk_score', 0):.0f}
Explain why this invoice was flagged, what the key risk indicators mean, and what the auditor should do next."""
    try:
        return {"explanation": _groq_call(prompt, max_tokens=220)}
    except Exception as e:
        return {"explanation": f"AI explanation unavailable: {e}"}
