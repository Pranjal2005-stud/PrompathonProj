# 🛡️ AI Fraud Intelligence Dashboard

A production-grade invoice fraud detection system powered by IsolationForest ML model with a React + FastAPI stack.

---

## 🚀 Tech Stack

| Layer    | Tech                                      |
|----------|-------------------------------------------|
| Frontend | Next.js 15, React 19, TailwindCSS, ECharts, Framer Motion, Lucide, Zustand |
| Backend  | FastAPI, Pandas, Scikit-learn, Uvicorn    |
| ML Model | IsolationForest (anomaly detection)       |

---

## ⚙️ Setup Instructions

### 1. Clone the repo

```bash
git clone https://github.com/Pranjal2005-stud/PrompathonProj.git
cd PrompathonProj
```

---

### 2. Backend Setup

```bash
cd backend
pip install -r requirements.txt
uvicorn app:app --reload
```

Backend runs on → `http://localhost:8000`

> ⚠️ Make sure `backend/models/anomaly_model.pkl` and `backend/models/scaler.pkl` exist before running. These are not included in the repo due to size. Train them separately or request from the team.

---

### 3. Frontend Setup

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
│   ├── feature_engineering.py  # Feature computation
│   ├── predict.py              # ML scoring + decision logic
│   ├── rule_engine.py          # Rule-based fraud flags
│   ├── explain.py              # AI explanation generator
│   ├── model_loader.py         # Loads .pkl model files
│   ├── utils.py                # Summary stats
│   └── requirements.txt
├── nextjs-frontend/
│   ├── app/                    # Next.js app router pages
│   ├── components/             # All UI components
│   ├── services/api.ts         # Axios API calls
│   ├── store/index.ts          # Zustand global state
│   ├── types/index.ts          # TypeScript types
│   ├── next.config.ts
│   └── package.json
└── README.md
```

---

## 📊 Features

- Upload CSV invoice file → instant fraud analysis
- ML anomaly detection (IsolationForest)
- Rule-based fraud flags (Overbilling, Duplicate, Missing PO, Overpayment)
- KPI cards with count-up animation
- Decision breakdown doughnut chart
- Risk score trend line chart
- Risk distribution bar chart
- Vendor risk heatmap
- Real-time toast notifications
- Sortable, searchable, paginated invoice table
- Slide-in invoice drawer with AI explanation
- Notification bell with alert dropdown

---

## 🧪 CSV Format

Your CSV should have these columns:

| Column               | Description                  |
|----------------------|------------------------------|
| `invoice_id`         | Unique invoice identifier    |
| `vendor_id`          | Vendor identifier            |
| `vendor_name`        | Vendor display name          |
| `invoice_amount`     | Invoice value                |
| `approved_amount_po` | PO approved amount           |
| `quantity`           | Invoiced quantity            |
| `approved_quantity_po` | PO approved quantity       |
| `paid_amount`        | Amount already paid          |
| `invoice_date`       | Date of invoice (YYYY-MM-DD) |
