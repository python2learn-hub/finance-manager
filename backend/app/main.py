from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import transactions, files
from .database import init_db

app = FastAPI(title="Finance Manager API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(transactions.router, prefix="/api/transactions", tags=["transactions"])
app.include_router(files.router, prefix="/api/files", tags=["files"])

@app.on_event("startup")
def on_startup():
    init_db()

@app.get("/healthz")
def health():
    return {"status": "ok"}
