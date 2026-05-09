"""
invoice_parser.py
-----------------
Entry point for all invoice uploads.
Handles CSV, PDF, and plain text.
Returns a canonical DataFrame ready for feature engineering.
"""

import io
import pandas as pd
from schema_normalizer import to_canonical
from llm_extractor import extract_with_llm


def _parse_csv(file_bytes: bytes) -> pd.DataFrame:
    """Parse CSV bytes into a normalized canonical DataFrame."""
    try:
        df = pd.read_csv(io.BytesIO(file_bytes))
        return to_canonical(df)
    except Exception as e:
        raise ValueError(f"CSV parse failed: {e}")


def _parse_pdf(file_bytes: bytes) -> pd.DataFrame:
    """
    Extract text from PDF using pdfplumber, then try LLM extraction.
    Falls back to regex if LLM fails.
    """
    text = ""
    try:
        import pdfplumber
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
    except ImportError:
        # pdfplumber not installed — decode raw bytes as text
        text = file_bytes.decode("utf-8", errors="ignore")
    except Exception as e:
        print(f"PDF extraction warning: {e}")
        text = file_bytes.decode("utf-8", errors="ignore")

    return _parse_text(text)


def _parse_text(text: str) -> pd.DataFrame:
    """Try LLM extraction first, then regex fallback."""
    # LLM extraction
    try:
        llm_data = extract_with_llm(text)
        if isinstance(llm_data, dict) and llm_data:
            df = pd.DataFrame([llm_data])
            return to_canonical(df)
    except Exception as e:
        print(f"LLM extraction failed: {e}")

    # Regex fallback
    print("Using regex fallback extraction")
    return _regex_extract(text)


def _regex_extract(text: str) -> pd.DataFrame:
    """
    Best-effort regex extraction from unstructured text.
    Returns a single-row canonical DataFrame.
    """
    import re
    data = {}

    patterns = {
        "vendor_name":        r"(?:vendor|supplier|billed\s*by|from)[:\s]+([A-Za-z0-9_&. ]+)",
        "invoice_id":         r"(?:invoice\s*(?:no|number|id)|bill\s*no)[:\s#]+([A-Za-z0-9\-/]+)",
        "invoice_amount":     r"(?:total|amount|payable|invoice\s*amount)[:\s₹$]*([0-9,]+(?:\.[0-9]+)?)",
        "approved_amount_po": r"(?:po\s*(?:amount|value)|purchase\s*order)[:\s₹$]*([0-9,]+(?:\.[0-9]+)?)",
        "paid_amount":        r"(?:paid|payment\s*made)[:\s₹$]*([0-9,]+(?:\.[0-9]+)?)",
        "quantity":           r"(?:qty|quantity|units)[:\s]*([0-9]+(?:\.[0-9]+)?)",
        "invoice_date":       r"(\d{4}-\d{2}-\d{2}|\d{2}[/-]\d{2}[/-]\d{4}|\d{2}\s+\w+\s+\d{4})",
        "item_name":          r"(?:item|description|particulars|goods|service)[:\s]+([A-Za-z0-9_ ]+)",
    }

    for field, pattern in patterns.items():
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            val = match.group(1).strip().replace(",", "")
            data[field] = val

    df = pd.DataFrame([data]) if data else pd.DataFrame([{}])
    return to_canonical(df)


def parse_input(file) -> pd.DataFrame:
    """
    Main entry point. Accepts FastAPI UploadFile.
    Returns canonical DataFrame.
    """
    filename = (file.filename or "").lower()
    raw = file.file.read()

    if filename.endswith(".csv"):
        return _parse_csv(raw)

    if filename.endswith(".pdf"):
        return _parse_pdf(raw)

    # Plain text / unknown format
    text = raw.decode("utf-8", errors="ignore")
    return _parse_text(text)
