Finance Manager – Python Backend Starter

Quick start
-----------
1) Install deps
   ```bash
   cd backend
   python -m venv .venv && source .venv/bin/activate  # Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   ```
2) Start **Postgres in Docker** (credentials provided)
   ```bash
   docker compose up -d postgres
   # waits until healthy
   ```
3) Run API
   ```bash
   uvicorn app.main:app --reload
   ```

Open http://127.0.0.1:8000/docs

What works now
--------------
• Add transaction (auto-categorizes by simple rules)
• List transactions
• Import CSV (date,amount,direction,merchant,narration)
• **Postgres via Docker is default** → DB: `finance_db`, user: `admin`, password: `admin`, host: `localhost:5432`. Override with `DB_URL` if needed.

Next steps
----------
• Add Accounts CRUD
• Extend parser to Excel/PDF (pdfplumber/openpyxl)
• Insights endpoints (monthly spend, savings rate)
• Auth (JWT) + Users
• Budgets & alerts
• Dockerfile + docker-compose (Postgres/MinIO)

CSV Template
------------
"date,amount,direction,merchant,narration"
"2025-10-01",250.0,"debit","Zomato","Dinner"
"2025-10-02",1200.0,"debit","Uber","Airport ride"
"2025-10-03",50000.0,"credit","Salary","Monthly salary"
