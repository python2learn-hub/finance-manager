from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .routers import accounts, dashboard, files, transactions
from .database import init_db

app = FastAPI(title="Finance Manager API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="app/static"), name="static")
app.include_router(accounts.router, prefix="/api/accounts", tags=["accounts"])
app.include_router(transactions.router, prefix="/api/transactions", tags=["transactions"])
app.include_router(files.router, prefix="/api/files", tags=["files"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])

@app.on_event("startup")
def on_startup():
    init_db()

@app.get("/healthz")
def health():
    return {"status": "ok"}

@app.get("/")
def index():
    return FileResponse("app/static/index.html")
