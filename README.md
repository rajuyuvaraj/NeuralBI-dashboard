# NeuralBI — AI-Powered Business Intelligence Dashboard

Ask questions in natural language. Get instant charts, SQL, and AI insights.

## 🧠 Powered By

- **AI Model**: Llama 3.3 70B via [Groq](https://groq.com) (sub-second inference)
- **Backend**: FastAPI + SQLite + Pandas
- **Frontend**: React 18 + Recharts + Framer Motion

## 🚀 Quick Start

### 1. Backend Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
copy .env.example .env
# Edit .env → add your GROQ_API_KEY
```

### 2. Seed Database

```bash
cd data
python seed_database.py
```

### 3. Start Backend

```bash
cd backend
uvicorn main:app --reload --port 8080
```

### 4. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

Visit **http://localhost:5173**

## 🔑 Get Your Free Groq API Key

1. Go to [console.groq.com](https://console.groq.com)
2. Sign up / Log in
3. Create an API key
4. Add to `backend/.env`: `GROQ_API_KEY=gsk_your_key_here`

## 📊 Features

- Natural language to SQL generation
- Auto chart selection (7 rule engine + LLM fallback)
- AI-powered insights (3 bullet points per chart)
- Confidence scoring for every result
- Follow-up queries with session context
- CSV upload with auto schema detection
- Demo safe mode (Ctrl+Shift+D)
- Voice input via Web Speech API
- Download charts as PNG
- SQL syntax highlighting with copy button
- Glassmorphism UI with animated particle background

## 🗃️ Seed Data

| Table | Rows | Description |
|-------|------|-------------|
| sales | 300 | Transactions with region, product, rep |
| customers | 20 | Companies with tiers and LTV |
| monthly_targets | 48 | Revenue/unit targets by region |

## 💡 Example Queries

- "Show total revenue by region"
- "Monthly sales trend for 2024"
- "Top 5 product categories by revenue"
- "Revenue by customer tier"
- "Q3 sales by region and category"
- "Which sales rep performed best?"
