"""Minimal CSV parser. Later: PDF (pdfplumber) & Excel (openpyxl)."""
from typing import List, Dict
import csv, io, hashlib
from datetime import datetime

REQUIRED_COLUMNS = {"date", "amount", "direction", "merchant", "narration"}

def checksum(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()

def parse_csv(content: bytes) -> List[Dict]:
    text = content.decode("utf-8")
    reader = csv.DictReader(io.StringIO(text))
    cols = set(c.strip().lower() for c in reader.fieldnames or [])
    if not REQUIRED_COLUMNS.issubset(cols):
        raise ValueError(f"CSV must contain: {REQUIRED_COLUMNS}")
    rows = []
    for row in reader:
        rows.append({
            "txn_date": datetime.strptime(row["date"], "%Y-%m-%d").date(),
            "amount": float(row["amount"]),
            "direction": row["direction"].strip().lower(),
            "merchant": row.get("merchant"),
            "narration": row.get("narration"),
        })
    return rows
