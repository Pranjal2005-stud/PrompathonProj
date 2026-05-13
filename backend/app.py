"""
app.py — FastAPI entry point
Endpoints: /predict /summary /alerts /vendors /copilot /explain /review/*
"""

import math
import os
import numpy as np
import pandas as pd
import requests
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL   = "llama-3.3-70b-versatile"

from invoice_parser import parse_input
from feature_engineering import compute_features
from predict import get_prediction
from model_loader import load_model
from utils import calculate_summary
from alert_engine import generate_alerts
from vendor_risk_engine import compute_vendor_risk_summary

model, scaler = None, None
_reviewer_actions: dict = {}
# Cache last scored DataFrame for /alerts and /vendors endpoints
_last_df: pd.DataFrame = pd.DataFrame()


# ── Sanitizer ─────────────────────────────────────────────────────────────────
def sanitize(df: pd.DataFrame) -> list:
    def clean(v):
        if v is None:
            return None
        try:
            if pd.isna(v):
                return None
        except (TypeError, ValueError):
            pass
        if isinstance(v, np.integer):
            return int(v)
        if isinstance(v, (np.floating, float)):
            f = float(v)
            return None if (math.isnan(f) or math.isinf(f)) else f
        if isinstance(v, np.bool_):
            return bool(v)
        if isinstance(v, pd.Timestamp):
            try:
                return str(v.date()) if not pd.isnull(v) else None
            except Exception:
                return None
        return v
    return [{k: clean(v) for k, v in row.items()} for row in df.to_dict(orient="records")]


def _groq_call(prompt: str, max_tokens: int = 220) -> str:
    if not GROQ_API_KEY:
        return "Groq API key not configured. Add GROQ_API_KEY to backend/.env"
    res = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    global model, scaler
    model, scaler = load_model()
    yield


app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"status": "running", "model_loaded": model is not None}


# ── /predict ──────────────────────────────────────────────────────────────────
@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    global _last_df
    df = await parse_input(file)
    df = compute_features(df)
    df = get_prediction(df, model, scaler)
    _last_df = df.copy()
    return sanitize(df)


# ── /summary ──────────────────────────────────────────────────────────────────
@app.post("/summary")
async def summary(file: UploadFile = File(...)):
    df = await parse_input(file)
    df = compute_features(df)
    df = get_prediction(df, model, scaler)
    return calculate_summary(df)


# ── /alerts ───────────────────────────────────────────────────────────────────
@app.get("/alerts")
def get_alerts():
    """Returns live alerts from the last uploaded dataset."""
    if _last_df.empty:
        return []
    return generate_alerts(_last_df)


# ── /vendors ──────────────────────────────────────────────────────────────────
@app.get("/vendors")
def get_vendors():
    if _last_df.empty:
        return []
    return compute_vendor_risk_summary(_last_df)


# ── /copilot ──────────────────────────────────────────────────────────────────
class CopilotRequest(BaseModel):
    question: str
    context: str = ""


@app.post("/copilot")
def copilot(req: CopilotRequest):
    prompt = f"""You are an AI Fraud Auditor for an enterprise procurement platform.
Context: {req.context}
Question: {req.question}
Answer in 3-4 sentences. Be specific with numbers and vendor names. Focus on fraud indicators and one actionable recommendation."""
    try:
        return {"answer": _groq_call(prompt, max_tokens=280)}
    except Exception as e:
        return {"answer": f"AI analysis unavailable: {e}"}


# ── /explain ──────────────────────────────────────────────────────────────────
class ExplainRequest(BaseModel):
    invoice: dict


@app.post("/explain")
def explain(req: ExplainRequest):
    inv = req.invoice
    prompt = (
        f"You are a procurement fraud auditor. In exactly 100-120 words explain why this invoice is flagged.\n"
        f"Vendor: {inv.get('vendor_name')} | Amount: ₹{inv.get('invoice_amount')} | "
        f"Risk: {inv.get('risk_score', 0):.0f}/100 | Decision: {inv.get('decision')}\n"
        f"Fraud Type: {inv.get('fraud_type', 'Unknown')} | "
        f"Flags: {inv.get('rule_flags', inv.get('reason', 'None'))}\n"
        f"ML Score: {inv.get('ml_risk_score', 0):.0f} | Network Risk: {inv.get('network_risk_score', 0):.0f}\n"
        f"Be specific. Mention the top 2-3 fraud signals. End with one recommended action."
    )
    try:
        return {"explanation": _groq_call(prompt, max_tokens=160)}
    except Exception:
        flags = inv.get('rule_flags', inv.get('reason', 'None'))
        return {"explanation": f"Invoice flagged for: {flags}. Risk score: {inv.get('risk_score',0):.0f}/100. Decision: {inv.get('decision')}. Recommend manual review."}


# ── /review/* ─────────────────────────────────────────────────────────────────
class ReviewerAction(BaseModel):
    invoice_id: str
    action: str
    note: str = ""
    reviewer: str = "Auditor"


@app.post("/review/action")
def reviewer_action(req: ReviewerAction):
    from datetime import datetime
    _reviewer_actions[req.invoice_id] = {
        "invoice_id": req.invoice_id,
        "action":     req.action,
        "note":       req.note,
        "reviewer":   req.reviewer,
        "timestamp":  datetime.utcnow().isoformat(),
    }
    return {"status": "recorded", "invoice_id": req.invoice_id, "action": req.action}


@app.get("/review/actions")
def get_reviewer_actions():
    return list(_reviewer_actions.values())


@app.get("/review/action/{invoice_id}")
def get_action(invoice_id: str):
    if invoice_id not in _reviewer_actions:
        raise HTTPException(status_code=404, detail="No action recorded for this invoice")
    return _reviewer_actions[invoice_id]
