"""Bank statement parsers for CSV, Excel, and best-effort PDF imports."""
from __future__ import annotations

import csv
import hashlib
import io
import re
from datetime import date, datetime
from typing import Any, Dict, Iterable, List, Optional

from openpyxl import load_workbook

REQUIRED_COLUMNS = {"date", "amount", "direction", "merchant", "narration"}

DATE_KEYS = {"date", "txn date", "transaction date"}
POSTED_DATE_KEYS = {"posted date", "value date", "value dt"}
NARRATION_KEYS = {"narration", "description", "details", "particulars", "transaction details", "remarks"}
MERCHANT_KEYS = {"merchant", "payee", "beneficiary"}
AMOUNT_KEYS = {"amount", "transaction amount"}
DEBIT_KEYS = {"debit", "withdrawal", "withdrawals", "withdrawal amt", "withdrawal amount", "dr", "paid out"}
CREDIT_KEYS = {"credit", "deposit", "deposits", "deposit amt", "deposit amount", "cr", "paid in"}
REFERENCE_KEYS = {"reference", "ref no", "chq ref no", "cheque ref no", "chq no"}
BALANCE_KEYS = {"balance", "closing balance", "running balance"}

HEADER_ALIASES = {
    "txn date": "date",
    "transaction date": "date",
    "value dt": "posted date",
    "value date": "posted date",
    "withdrawal amt": "debit",
    "withdrawal amount": "debit",
    "withdrawals": "debit",
    "dr": "debit",
    "deposit amt": "credit",
    "deposit amount": "credit",
    "deposits": "credit",
    "cr": "credit",
    "chq ref no": "reference",
    "cheque ref no": "reference",
    "ref no": "reference",
    "closing balance": "balance",
    "running balance": "balance",
}


def checksum(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def row_checksum(account_id: int, row: Dict[str, Any]) -> str:
    metadata = row.get("metadata_") or {}
    raw = "|".join(
        [
            str(account_id),
            row["txn_date"].isoformat(),
            row.get("posted_date").isoformat() if row.get("posted_date") else "",
            str(round(float(row["amount"]), 2)),
            row["direction"],
            str(metadata.get("reference") or ""),
            row.get("merchant") or "",
            row.get("narration") or "",
        ]
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def parse_statement(filename: str, content: bytes) -> List[Dict[str, Any]]:
    suffix = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if suffix == "csv":
        return parse_csv(content)
    if suffix in {"xlsx", "xlsm"}:
        return parse_excel(content)
    if suffix == "pdf":
        return parse_pdf(content)
    raise ValueError("Supported statement formats: .csv, .xlsx, .xlsm, .pdf. Convert legacy .xls files to .xlsx before importing.")


def parse_csv(content: bytes) -> List[Dict[str, Any]]:
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise ValueError("CSV has no header row")

    field_map = {name: _canonical_header(name) for name in reader.fieldnames}
    canonical_headers = set(field_map.values())

    rows = []
    for raw in reader:
        canonical_row = {canonical: raw.get(original) for original, canonical in field_map.items()}
        if REQUIRED_COLUMNS.issubset(canonical_headers):
            rows.append(_row_from_template(canonical_row))
            continue

        normalized = _normalize_mapping(canonical_row)
        if normalized:
            rows.append(normalized)
    if not rows:
        raise ValueError("No valid transactions found in CSV")
    return rows


def parse_excel(content: bytes) -> List[Dict[str, Any]]:
    workbook = load_workbook(io.BytesIO(content), data_only=True, read_only=True)
    for sheet in workbook.worksheets:
        rows = list(sheet.iter_rows(values_only=True))
        parsed = _parse_table_rows(rows)
        if parsed:
            return parsed
    raise ValueError("No valid transactions found in Excel workbook")


def parse_pdf(content: bytes) -> List[Dict[str, Any]]:
    try:
        import pdfplumber
    except ImportError as exc:
        raise ValueError("PDF support requires pdfplumber") from exc

    rows: List[Dict[str, Any]] = []
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for page in pdf.pages:
            for table in page.extract_tables() or []:
                parsed = _parse_table_rows(table)
                if parsed:
                    rows.extend(parsed)
            if rows:
                continue
            text = page.extract_text() or ""
            rows.extend(_parse_pdf_lines(text.splitlines()))
    if not rows:
        raise ValueError("No valid transactions found in PDF. Try Excel export if your bank provides it.")
    return rows


def _parse_table_rows(rows: Iterable[Iterable[Any]]) -> List[Dict[str, Any]]:
    row_list = [list(row) for row in rows if row and any(cell is not None and str(cell).strip() for cell in row)]
    for index, row in enumerate(row_list[:20]):
        headers = [_clean_header(cell) for cell in row]
        if _looks_like_header(headers):
            parsed = []
            for values in row_list[index + 1 :]:
                mapping = {_canonical_header(headers[i]): values[i] if i < len(values) else None for i in range(len(headers))}
                normalized = _normalize_mapping(mapping)
                if normalized:
                    parsed.append(normalized)
            return parsed
    return []


def _looks_like_header(headers: List[str]) -> bool:
    header_set = set(headers)
    has_date = bool(header_set & DATE_KEYS)
    has_text = bool(header_set & NARRATION_KEYS or header_set & MERCHANT_KEYS)
    has_amount = bool(header_set & AMOUNT_KEYS or header_set & DEBIT_KEYS or header_set & CREDIT_KEYS)
    return has_date and has_text and has_amount


def _normalize_mapping(raw: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    txn_date = _first_date(raw, DATE_KEYS)
    posted_date = _first_date(raw, POSTED_DATE_KEYS)
    narration = _first_text(raw, NARRATION_KEYS)
    merchant = _first_text(raw, MERCHANT_KEYS) or _merchant_from_narration(narration)
    reference = _first_text(raw, REFERENCE_KEYS)
    balance = _first_number(raw, BALANCE_KEYS)

    amount = _first_number(raw, AMOUNT_KEYS)
    debit = _first_number(raw, DEBIT_KEYS)
    credit = _first_number(raw, CREDIT_KEYS)

    direction = None
    if debit and debit > 0:
        amount = debit
        direction = "debit"
    elif credit and credit > 0:
        amount = credit
        direction = "credit"
    elif amount is not None:
        direction = "debit" if amount < 0 else _direction_from_text(raw) or "debit"
        amount = abs(amount)

    if not txn_date or amount is None or not direction:
        return None

    return {
        "txn_date": txn_date,
        "posted_date": posted_date,
        "amount": float(amount),
        "direction": direction,
        "merchant": merchant,
        "narration": narration,
        "metadata_": {
            "reference": reference,
            "closing_balance": balance,
        },
    }


def _row_from_template(row: Dict[str, str]) -> Dict[str, Any]:
    txn_date = _parse_date(row["date"])
    if not txn_date:
        raise ValueError(f"Invalid transaction date: {row.get('date')}")
    direction = (row["direction"] or "").strip().lower()
    if direction not in {"debit", "credit"}:
        raise ValueError("direction must be debit or credit")
    try:
        amount = abs(float(_clean_number(row["amount"])))
    except ValueError as exc:
        raise ValueError(f"Invalid amount: {row.get('amount')}") from exc
    return {
        "txn_date": txn_date,
        "amount": amount,
        "direction": direction,
        "merchant": row.get("merchant"),
        "narration": row.get("narration"),
    }


def _parse_pdf_lines(lines: Iterable[str]) -> List[Dict[str, Any]]:
    parsed = []
    pattern = re.compile(r"(?P<date>\d{1,2}[-/]\d{1,2}[-/]\d{2,4}).*?(?P<amount>-?\d[\d,]*\.?\d{0,2})\s*(?P<kind>dr|cr|debit|credit)?$", re.I)
    for line in lines:
        match = pattern.search(line.strip())
        if not match:
            continue
        txn_date = _parse_date(match.group("date"))
        amount = abs(float(_clean_number(match.group("amount"))))
        kind = (match.group("kind") or "debit").lower()
        direction = "credit" if kind in {"cr", "credit"} else "debit"
        narration = line[: match.start("amount")].strip()
        parsed.append({
            "txn_date": txn_date,
            "amount": amount,
            "direction": direction,
            "merchant": _merchant_from_narration(narration),
            "narration": narration,
        })
    return parsed


def _clean_header(value: Any) -> str:
    text = str(value or "").strip().lower()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _canonical_header(value: Any) -> str:
    header = _clean_header(value)
    return HEADER_ALIASES.get(header, header)


def _first_text(raw: Dict[str, Any], keys: set[str]) -> Optional[str]:
    for key in keys:
        value = raw.get(key)
        text = str(value).strip() if value is not None else ""
        if text and text.lower() not in {"none", "nan", "null"}:
            return text
    return None


def _first_date(raw: Dict[str, Any], keys: set[str]) -> Optional[date]:
    for key in keys:
        value = raw.get(key)
        if value:
            parsed = _parse_date(value)
            if parsed:
                return parsed
    return None


def _first_number(raw: Dict[str, Any], keys: set[str]) -> Optional[float]:
    for key in keys:
        value = raw.get(key)
        if value is None or str(value).strip() == "":
            continue
        try:
            return float(_clean_number(value))
        except ValueError:
            continue
    return None


def _parse_date(value: Any) -> Optional[date]:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = str(value).strip()
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%y", "%d/%m/%y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            pass
    return None


def _clean_number(value: Any) -> str:
    text = str(value).strip().replace(",", "").replace("₹", "")
    if text.lower() in {"", "none", "nan", "null"}:
        return ""
    text = re.sub(r"\b(INR|Rs\.?|CR|DR)\b", "", text, flags=re.I).strip()
    if text in {"-", "--"}:
        return ""
    if text.startswith("(") and text.endswith(")"):
        text = "-" + text[1:-1]
    return text


def _direction_from_text(raw: Dict[str, Any]) -> Optional[str]:
    haystack = " ".join(str(value).lower() for value in raw.values() if value is not None)
    if re.search(r"\b(cr|credit)\b", haystack):
        return "credit"
    if re.search(r"\b(dr|debit)\b", haystack):
        return "debit"
    return None


def _merchant_from_narration(narration: Optional[str]) -> Optional[str]:
    if not narration:
        return None
    text = re.sub(r"\s+", " ", narration).strip()
    upi_match = re.match(r"upi[-/:\s]+(.+)", text, flags=re.I)
    if upi_match:
        parts = [part.strip() for part in upi_match.group(1).split("-") if part.strip()]
        if parts:
            return parts[0][:80]

    neft_match = re.match(r"neft\s+cr[-/:\s]+(?:[^-]+-){1,2}([^-]+)", text, flags=re.I)
    if neft_match:
        return neft_match.group(1).strip()[:80]

    text = re.sub(r"^(neft|imps|rtgs|pos|atm|card|transfer)[-/:\s]+", "", text, flags=re.I)
    return text[:80] or None
