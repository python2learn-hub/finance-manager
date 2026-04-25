Finance Manager
===============

A local expense-tracking app for importing bank statements and viewing spend KPIs.

What it does
------------
- Create bank, credit card, wallet, cash, broker accounts.
- Import statements from CSV, XLSX, XLSM, and best-effort PDF.
- Auto-categorize transactions with simple rules.
- Skip duplicate statement files and repeated rows.
- Show dashboard KPIs:
  - total spend
  - income
  - net cashflow
  - savings rate
  - average daily spend
  - largest expense
  - transaction count
  - category spend
  - monthly cashflow
  - daily spend trend
  - top merchants
  - recent transactions

Run locally
-----------
From the project root:

```powershell
docker compose up -d postgres
```

From `backend`:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Open:

```text
http://127.0.0.1:8000/
```

API docs:

```text
http://127.0.0.1:8000/docs
```

Database
--------
Docker Postgres is used by default:

```text
DB: finance_db
User: admin
Password: admin
Host: localhost
Port: 5433
```

The app uses `5433` on the Windows host to avoid conflicts with a local Postgres install on `5432`.

You can override the connection string:

```powershell
$env:DB_URL="postgresql+psycopg2://admin:admin@localhost:5433/finance_db"
```

Statement formats
-----------------
Preferred format: Excel `.xlsx`.

Supported column names include common variants:

```text
Transaction Date, Date, Value Date
Description, Narration, Particulars, Transaction Details
Debit, Withdrawal, Dr
Credit, Deposit, Cr
Withdrawal Amt., Deposit Amt., Closing Balance
Amount
Merchant, Payee, Beneficiary
Chq./Ref.No., Reference
```

CSV template:

```csv
date,amount,direction,merchant,narration
2026-04-01,250.0,debit,Zomato,Dinner
2026-04-02,1200.0,debit,Uber,Airport ride
2026-04-03,50000.0,credit,Salary,Monthly salary
```

PDF support is best effort because every bank formats PDF statements differently. Use Excel export when available.

Useful commands
---------------
```powershell
docker compose ps
docker exec fm-postgres pg_isready -U admin -d finance_db
docker compose down
```
