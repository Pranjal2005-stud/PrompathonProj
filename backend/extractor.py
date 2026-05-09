import pandas as pd
import pdfplumber

def extract_from_csv(file):
    df = pd.read_csv(file)
    return df.to_dict(orient="records")


def extract_from_pdf(file):
    text = ""

    with pdfplumber.open(file) as pdf:
        for page in pdf.pages:
            text += page.extract_text() + "\n"

    return parse_text_to_json(text)


def parse_text_to_json(text):
    # simple fallback parser (LLM will improve later)
    data = {}

    lines = text.split("\n")

    for line in lines:
        if "invoice" in line.lower():
            data["invoice_id"] = line.split()[-1]

        if "amount" in line.lower():
            data["invoice_amount"] = float(''.join(filter(str.isdigit, line)))

        if "vendor" in line.lower():
            data["vendor_name"] = line.split(":")[-1].strip()

    return [data]