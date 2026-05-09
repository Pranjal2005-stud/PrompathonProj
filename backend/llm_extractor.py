"""
llm_extractor.py
----------------
Uses Groq LLM to extract structured invoice fields from unstructured text.
Returns a dict matching canonical schema fields.
"""

import os
import json
import re
import requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")


def extract_with_llm(text: str) -> dict:
    if not GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY not set in .env")

    # Truncate to avoid token limits
    truncated = text[:4000]

    prompt = f"""You are a forensic invoice data extractor.

Extract ALL available invoice fields from the text below.

Return ONLY a valid JSON object with these exact keys (use null for missing fields):
{{
  "invoice_id": null,
  "vendor_id": null,
  "vendor_name": null,
  "invoice_amount": null,
  "approved_amount_po": null,
  "paid_amount": null,
  "unit_price": null,
  "quantity": null,
  "approved_quantity_po": null,
  "invoice_date": null,
  "item_name": null
}}

Rules:
- invoice_amount, approved_amount_po, paid_amount, unit_price, quantity must be numbers (not strings)
- invoice_date must be in YYYY-MM-DD format if possible
- Do NOT include any explanation, markdown, or extra text
- If a field is not found, use null

TEXT:
{truncated}
"""

    response = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
        json={
            "model": "llama-3.3-70b-versatile",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.1,
            "max_tokens": 512,
        },
        timeout=20,
    )
    response.raise_for_status()

    content = response.json()["choices"][0]["message"]["content"].strip()

    # Strip markdown fences
    content = re.sub(r"^```(?:json)?\s*", "", content)
    content = re.sub(r"\s*```$", "", content)

    data = json.loads(content)

    # Remove null values so downstream defaults apply
    return {k: v for k, v in data.items() if v is not None}
