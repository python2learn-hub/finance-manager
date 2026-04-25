Finance Manager
===============

Local finance dashboard with a React frontend, FastAPI backend, and Postgres database.

Run
---

From the project root:

```powershell
docker compose up --build
```

Open:

```text
http://127.0.0.1:5173/
```

API docs:

```text
http://127.0.0.1:8000/docs
```

Services
--------

- `frontend`: React + Vite on port `5173`
- `backend`: FastAPI on port `8000`
- `postgres`: Postgres on host port `5433`

Local Frontend
--------------

If Node.js is installed locally:

```powershell
cd frontend
npm install
npm run dev
```

The Vite dev server proxies `/api` requests to the backend.

Local Backend
-------------

If Python is installed locally:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
$env:DB_URL="postgresql+psycopg2://admin:admin@localhost:5433/finance_db"
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```
