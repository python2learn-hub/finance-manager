from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, declarative_base
import os

DB_URL = os.getenv("DB_URL", "postgresql+psycopg2://admin:admin@localhost:5433/finance_db")
engine = create_engine(DB_URL, connect_args={"check_same_thread": False} if DB_URL.startswith("sqlite") else {})
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    from . import models  # noqa: F401
    Base.metadata.create_all(bind=engine)
    _apply_lightweight_migrations()


def _apply_lightweight_migrations():
    inspector = inspect(engine)
    if "statements" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("statements")}
    with engine.begin() as conn:
        if "imported_count" not in columns:
            conn.execute(text("ALTER TABLE statements ADD COLUMN imported_count INTEGER DEFAULT 0"))
