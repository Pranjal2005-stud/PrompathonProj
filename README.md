# 🛡️ FraudShield — AI Procurement Fraud Detection

An enterprise-grade invoice fraud detection system powered by IsolationForest + XGBoost ML models, graph analytics, and Groq AI explanations.

---

## 🚀 Tech Stack

| Layer    | Tech |
|----------|------|
| Frontend | Next.js 15, React 19, TailwindCSS, Apache ECharts, Framer Motion, Zustand |
| Backend  | FastAPI, Pandas, Scikit-learn, XGBoost, NetworkX |
| ML       | IsolationForest + XGBoost (hybrid scoring) |
| AI       | Groq (llama-3.3-70b) for explanations |

---

## ⚙️ Setup Instructions

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/invoice-fraud-system.git
cd invoice-fraud-system
```

---

### 2. Backend Setup

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# Mac/Linux
source venv/bin/activate

pip install -r requirements.txt
```

**Create your `.env` file:**

```bash
cp .env.example .env
```

Open `backend/.env` and add your Groq API key:

```
GROQ_API_KEY=your_groq_api_key_here
```

Get a free key at → https://console.groq.com

> The app works without a Groq key — AI explanations will use the built-in fallback instead.

**Start the backend:**

```bash
uvicorn app:app --reload
```

Backend runs on → `http://localhost:8000`

---

### 3. Frontend Setup

Open a second terminal:

```bash
cd nextjs-frontend
npm install
npm run dev
```

Frontend runs on → `http://localhost:3000`

---

## 📂 Project Structure

```
invoice-fraud-system/
├── backend/
│   ├── app.py                  # FastAPI entry point
│   ├── config.py               # All thresholds and weights
│   ├── feature_engineering.py  # 18 ML feature pipeline
│   ├── predict.py              # Hybrid scoring engine
│   ├── rule_engine.py          # Deterministic fraud rules
│   ├── graph_engine.py         # Vendor collusion graph
│   ├── invoice_parser.py       # CSV/Excel parser + column mapping
│   ├── alert_engine.py         # Live alert generator
│   ├── explain.py              # AI explanation generator
│   ├── model_loader.py         # Loads .pkl model files
│   ├── data_loader.py          # Loads vendor master + benchmark
│   ├── canonical_schema.py     # Schema + confidence scoring
│   ├── models/
│   │   ├── iforest.pkl         # IsolationForest model
│   │   ├── xgb.pkl             # XGBoost model
│   │   └── scaler (1).pkl      # Feature scaler
│   ├── data/
│   │   ├── vendor_master.csv
│   │   └── price_benchmark.json
│   ├── requirements.txt
│   ├── .env.example
│   └── .env                    # ← create this yourself (not in git)
└── nextjs-frontend/
    ├── app/                    # Next.js App Router pages
    ├── components/             # All UI components
    ├── services/api.ts         # Backend API calls
    ├── store/index.ts          # Zustand global state
    ├── types/index.ts          # TypeScript types
    └── package.json
```

---

## 📊 Features

- Upload CSV invoice file → instant fraud analysis
- Hybrid ML scoring (IsolationForest + XGBoost + rules)
- Shell vendor and collusion detection via graph analytics
- Invoice splitting and threshold avoidance detection
- KPI dashboard with animated counters
- Live fraud alerts panel
- Vendor risk heatmap (Apache ECharts)
- Sortable, searchable, paginated invoice table
- AI forensic explanation per invoice (Groq)
- AI Copilot chatbot
- PDF report export
- Debug endpoint: `POST /debug/fraud-score`
- Upload diagnostics: `POST /upload/diagnostics`

---

## 📋 CSV Format

Your CSV should have these columns (many aliases are supported automatically):

| Column | Aliases also accepted |
|--------|----------------------|
| `vendor_name` | `vendor`, `supplier`, `company_name` |
| `invoice_amount` | `amount`, `total`, `total_amount` |
| `invoice_date` | `date`, `bill_date`, `txn_date` |
| `vendor_id` | `vendor_code`, `supplier_id` |
| `approved_amount_po` | `po_amount`, `approved_amount` |
| `paid_amount` | `payment`, `amount_paid` |
| `bank_account` | `bank`, `acc_no`, `account_number` |
| `gst_number` | `gst_id`, `gstin`, `tax_id` |
| `vendor_address` | `address`, `city`, `location` |

---

## 🔑 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | Optional | Enables AI explanations. App works without it. |

---

## 🧪 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/predict` | Upload CSV, get fraud scores |
| GET | `/kpi` | Dashboard KPI metrics |
| GET | `/alerts` | Paginated fraud alerts |
| GET | `/transactions` | Paginated invoice list |
| GET | `/vendors` | Per-vendor risk summary |
| POST | `/explain` | AI explanation for one invoice |
| POST | `/copilot` | AI chat |
| POST | `/debug/fraud-score` | Full scoring breakdown |
| POST | `/upload/diagnostics` | Column mapping report |
| POST | `/review/action` | Record reviewer decision |
