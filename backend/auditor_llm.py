import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

client = Groq(api_key=os.getenv("GROQ_API_KEY", ""))

def audit_with_llm(invoice, prediction, flags):

    prompt = f"""
    You are a forensic auditor.

    Invoice Data:
    {invoice}

    Model Prediction:
    {prediction}

    Rule Flags:
    {flags}

    Tasks:
    1. Explain why this invoice might be fraudulent
    2. Also explain why it might be legitimate
    3. Give final verdict

    Output JSON:
    {{
      "risk_level": "",
      "reasoning": "",
      "confidence": ""
    }}
    """

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2
    )

    return response.choices[0].message.content