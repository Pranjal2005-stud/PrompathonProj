"""
app.py — FastAPI entry point

Endpoints:
  POST /predict              — upload CSV, score all invoices
  GET  /kpi                  — aggregated KPI metrics
  GET  /alerts               — paginated fraud alerts
  GET  /transactions         — paginated invoice list
  GET  /vendors              — per-vendor risk summary
  POST /copilot              — Groq AI chat
  POST /explain              — per-invoice AI explanation
  POST /debug/fraud-score    — full scoring breakdown for one invoice
  POST /review/action        — record reviewer decision
  GET  /review/actions
  GET  /review/action/{id}
"""

import logging
import math
import os
import time
from contextlib import asynccontextmanager
from typing import Optional

import numpy as np
import pandas as pd
import requests
from dotenv import load_dotenv
from fastapi import FastAPI, Query, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL   = "llama-3.3-70b-versatile"

from invoice_parser import parse_input, parse_diagnostics
from feature_engineering import compute_features
from predict import get_prediction
from model_loader import load_model
from utils import calculate_summary
from alert_engine import generate_alerts
from explain import explain_single
from config import ML_FEATURES

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

model, scaler = None, None
_reviewer_actions: dict = {}
_last_df: pd.DataFrame  = pd.DataFrame()


# ---------------------------------------------------------------------------
# Serializer
# ---------------------------------------------------------------------------

def _clean_val(v):
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


def sanitize(df: pd.DataFrame) -> list:
    return [{k: _clean_val(v) for k, v in row.items()}
            for row in df.to_dict(orient="records")]


# ---------------------------------------------------------------------------
# Groq helper
# ---------------------------------------------------------------------------

def _groq_call(prompt: str, max_tokens: int = 200) -> str:
    if not GROQ_API_KEY:
        return "Groq API key not configured. Add GROQ_API_KEY to backend/.env"
    res = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={"Authorization": f"Bearer {GROQ_API_KEY}",
                 "Content-Type": "application/json"},
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


# ---------------------------------------------------------------------------
# App lifecycle
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# /upload/diagnostics  — column mapping report before full processing
# ---------------------------------------------------------------------------

@app.post("/upload/diagnostics")
async def upload_diagnostics(file: UploadFile = File(...)):
    """
    Returns a full column mapping report for an uploaded file WITHOUT
    running the full prediction pipeline.
    Use this to debug column name mismatches before uploading for analysis.
    """
    import io as _io
    content = await file.read()
    name    = (file.filename or "").lower()

    if name.endswith((".xlsx", ".xls")):
        df_raw = pd.read_excel(_io.BytesIO(content))
    else:
        for enc in ("utf-8", "latin-1", "cp1252"):
            try:
                df_raw = pd.read_csv(_io.BytesIO(content), encoding=enc)
                break
            except UnicodeDecodeError:
                continue
        else:
            df_raw = pd.read_csv(_io.BytesIO(content), encoding="utf-8", errors="replace")

    diag = parse_diagnostics(df_raw)

    # Also report unique vendor count after normalisation
    from invoice_parser import _normalize_columns, _ensure_vendor_id, _coerce_types
    from canonical_schema import CANONICAL_FIELDS
    df_norm = _normalize_columns(df_raw.copy())
    df_norm = _coerce_types(df_norm)
    df_norm = _ensure_vendor_id(df_norm)
    diag["unique_vendor_count"]  = int(df_norm["vendor_id"].nunique())
    diag["total_rows"]           = len(df_norm)
    diag["sample_vendor_ids"]    = df_norm["vendor_id"].unique()[:10].tolist()

    return diag


# ---------------------------------------------------------------------------
# /predict
# ---------------------------------------------------------------------------

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    global _last_df
    t0 = time.perf_counter()

    df = await parse_input(file)
    df = compute_features(df)
    df = get_prediction(df, model, scaler)
    _last_df = df.copy()

    elapsed = time.perf_counter() - t0
    log.info("/predict: %d rows in %.3fs", len(df), elapsed)
    return sanitize(df)


# ---------------------------------------------------------------------------
# /kpi
# ---------------------------------------------------------------------------

@app.get("/kpi")
def get_kpi():
    if _last_df.empty:
        return {
            "total": 0, "fraud_detected": 0, "blocked": 0,
            "review": 0, "approved": 0, "fraud_rate": 0.0,
            "amount_saved": 0.0, "critical_count": 0,
            "high_count": 0, "avg_risk_score": 0.0,
        }
    df = _last_df
    total        = len(df)
    blocked      = int((df["decision"] == "BLOCK").sum())
    review       = int((df["decision"] == "REVIEW").sum())
    approved     = int((df["decision"] == "APPROVE").sum())
    fraud_det    = int((df["risk_score"] >= 55).sum())
    amount_saved = float(
        df.loc[df["decision"] == "BLOCK", "invoice_amount"].sum()
        if "invoice_amount" in df.columns else 0
    )
    critical = int((df.get("alert_level", pd.Series()) == "CRITICAL").sum())
    high     = int((df.get("alert_level", pd.Series()) == "HIGH").sum())
    avg_risk = float(df["risk_score"].mean()) if "risk_score" in df.columns else 0.0

    return {
        "total":          total,
        "fraud_detected": fraud_det,
        "blocked":        blocked,
        "review":         review,
        "approved":       approved,
        "fraud_rate":     round(fraud_det / max(total, 1) * 100, 1),
        "amount_saved":   round(amount_saved, 2),
        "critical_count": critical,
        "high_count":     high,
        "avg_risk_score": round(avg_risk, 1),
    }


# ---------------------------------------------------------------------------
# /alerts
# ---------------------------------------------------------------------------

@app.get("/alerts")
def get_alerts(
    page:     int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    severity: Optional[str] = Query(None),
):
    if _last_df.empty:
        return {"alerts": [], "total": 0, "page": page, "per_page": per_page}

    alerts = generate_alerts(_last_df)

    if severity:
        alerts = [a for a in alerts if a.get("alert_level") == severity.upper()]

    total = len(alerts)
    start = (page - 1) * per_page
    paged = alerts[start: start + per_page]

    return {"alerts": paged, "total": total, "page": page, "per_page": per_page}


# ---------------------------------------------------------------------------
# /transactions
# ---------------------------------------------------------------------------

@app.get("/transactions")
def get_transactions(
    page:     int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=500),
    decision: Optional[str] = Query(None),
    min_risk: float = Query(0.0, ge=0.0, le=100.0),
):
    if _last_df.empty:
        return {"transactions": [], "total": 0, "page": page, "per_page": per_page}

    df = _last_df.copy()

    if decision:
        df = df[df["decision"] == decision.upper()]
    if min_risk > 0:
        df = df[df["risk_score"] >= min_risk]

    df    = df.sort_values("risk_score", ascending=False)
    total = len(df)
    start = (page - 1) * per_page
    paged = df.iloc[start: start + per_page]

    return {
        "transactions": sanitize(paged),
        "total":        total,
        "page":         page,
        "per_page":     per_page,
    }


# ---------------------------------------------------------------------------
# /vendors
# ---------------------------------------------------------------------------

@app.get("/vendors")
def get_vendors():
    if _last_df.empty:
        return []
    df = _last_df
    result = []
    for vendor, grp in df.groupby("vendor_name"):
        avg_risk    = float(grp["risk_score"].mean())
        blocked     = int((grp["decision"] == "BLOCK").sum())
        suspicious  = int((grp["risk_score"] >= 55).sum())
        shared_bank = int(grp.get("shared_bank_account", pd.Series(0)).max() or 0)
        net_risk    = float(grp.get("network_risk_score", pd.Series(0)).mean() or 0)
        fraud_types = (
            grp["fraud_type"].value_counts().to_dict()
            if "fraud_type" in grp.columns else {}
        )
        result.append({
            "vendor_name":         str(vendor),
            "vendor_id":           str(grp["vendor_id"].iloc[0]),
            "invoice_count":       len(grp),
            "avg_risk_score":      round(avg_risk, 1),
            "blocked_count":       blocked,
            "suspicious_count":    suspicious,
            "shared_bank_account": shared_bank,
            "network_risk_score":  round(net_risk, 1),
            "fraud_types":         fraud_types,
            "alert_level": (
                "CRITICAL" if avg_risk >= 75 else
                "HIGH"     if avg_risk >= 55 else
                "MEDIUM"   if avg_risk >= 40 else "LOW"
            ),
        })
    result.sort(key=lambda x: -x["avg_risk_score"])
    return result


# ---------------------------------------------------------------------------
# /summary
# ---------------------------------------------------------------------------

@app.post("/summary")
async def summary(file: UploadFile = File(...)):
    df = await parse_input(file)
    df = compute_features(df)
    df = get_prediction(df, model, scaler)
    return calculate_summary(df)


# ---------------------------------------------------------------------------
# /copilot
# ---------------------------------------------------------------------------

class CopilotRequest(BaseModel):
    question: str
    context: str = ""


@app.post("/copilot")
def copilot(req: CopilotRequest):
    prompt = (
        "You are an AI Fraud Auditor for an enterprise procurement platform.\n"
        f"Context: {req.context}\n"
        f"Question: {req.question}\n"
        "Answer in 3-4 sentences. Be specific with numbers and vendor names. "
        "Focus on fraud indicators and one actionable recommendation."
    )
    try:
        return {"answer": _groq_call(prompt, max_tokens=280)}
    except Exception as e:
        return {"answer": f"AI analysis unavailable: {e}"}


# ---------------------------------------------------------------------------
# /explain
# ---------------------------------------------------------------------------

class ExplainRequest(BaseModel):
    invoice: dict


@app.post("/explain")
def explain(req: ExplainRequest):
    inv = req.invoice
    prompt = (
        "You are a procurement fraud auditor. In exactly 100-120 words explain why this invoice is flagged.\n"
        f"Vendor: {inv.get('vendor_name')} | Amount: \u20b9{inv.get('invoice_amount')} | "
        f"Risk: {inv.get('risk_score', 0):.0f}/100 | Decision: {inv.get('decision')}\n"
        f"Fraud Type: {inv.get('fraud_type', 'Unknown')} | "
        f"Flags: {inv.get('rule_flags', inv.get('reason', 'None'))}\n"
        f"ML Score: {inv.get('ml_risk_score', 0):.0f} | "
        f"Network Risk: {inv.get('network_risk_score', 0):.0f}\n"
        "Mention the top 2-3 fraud signals. End with one recommended action."
    )
    try:
        return {"explanation": _groq_call(prompt, max_tokens=160)}
    except Exception:
        return {"explanation": explain_single(inv)}


# ---------------------------------------------------------------------------
# /debug/fraud-score
# ---------------------------------------------------------------------------

class DebugRequest(BaseModel):
    invoice_id: str = ""
    vendor_name: str = ""


@app.post("/debug/fraud-score")
def debug_fraud_score(req: DebugRequest):
    if _last_df.empty:
        raise HTTPException(status_code=404, detail="No dataset loaded. Upload a CSV first.")

    df = _last_df

    if req.invoice_id:
        mask = df["invoice_id"].astype(str) == str(req.invoice_id)
    elif req.vendor_name:
        mask = df["vendor_name"].str.lower() == req.vendor_name.lower()
    else:
        raise HTTPException(status_code=400, detail="Provide invoice_id or vendor_name")

    matches = df[mask]
    if matches.empty:
        raise HTTPException(status_code=404, detail="Invoice not found in last dataset")

    row = matches.iloc[0].to_dict()

    def _safe(v):
        if v is None:
            return None
        try:
            if pd.isna(v):
                return None
        except Exception:
            pass
        if isinstance(v, (float, np.floating)):
            f = float(v)
            return None if (math.isnan(f) or math.isinf(f)) else round(f, 4)
        if isinstance(v, np.integer):
            return int(v)
        if isinstance(v, np.bool_):
            return bool(v)
        return v

    return {
        "invoice_id":     _safe(row.get("invoice_id")),
        "vendor_name":    row.get("vendor_name"),
        "invoice_amount": _safe(row.get("invoice_amount")),
        "scores": {
            "ml_risk_score":      _safe(row.get("ml_risk_score")),
            "anomaly_score":      _safe(row.get("anomaly_score")),
            "rule_score":         _safe(row.get("rule_score")),
            "behavior_score":     _safe(row.get("behavior_score")),
            "network_risk_score": _safe(row.get("network_risk_score")),
            "final_risk_score":   _safe(row.get("risk_score")),
        },
        "decision":       row.get("decision"),
        "fraud_type":     row.get("fraud_type"),
        "alert_level":    row.get("alert_level"),
        "force_escalate": bool(row.get("force_escalate", False)),
        "rule_flags":     row.get("rule_flags"),
        "reason":         row.get("reason"),
        "graph_signals": {
            "vendor_degree":       _safe(row.get("vendor_degree")),
            "cluster_size":        _safe(row.get("cluster_size")),
            "pagerank":            _safe(row.get("pagerank")),
            "co_occurrence_score": _safe(row.get("co_occurrence_score")),
            "shell_vendor_flag":   _safe(row.get("shell_vendor_flag")),
            "shared_bank_flag":    _safe(row.get("shared_bank_flag")),
            "shared_gst_flag":     _safe(row.get("shared_gst_flag")),
            "shared_address_flag": _safe(row.get("shared_address_flag")),
        },
        "ml_features": {
            feat: _safe(row.get(feat)) for feat in [
                "amount", "vendor_mean", "vendor_std", "amount_zscore",
                "amount_ratio", "invoice_gap_days", "vendor_frequency",
                "split_cluster_flag", "window_invoice_count",
                "cluster_amount_ratio", "entropy_score",
            ]
        },
    }


# ---------------------------------------------------------------------------
# /review/*
# ---------------------------------------------------------------------------

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
