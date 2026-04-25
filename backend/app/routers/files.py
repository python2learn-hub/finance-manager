from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models
from ..services import parser
from ..services.categorizer import categorize

router = APIRouter()

@router.post("/import")
async def import_statement(account_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    account = db.get(models.Account, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    content = await file.read()
    file_hash = parser.checksum(content)
    existing_statement = db.query(models.Statement).filter_by(hash=file_hash).first()
    if existing_statement:
        return {"imported": 0, "skipped": 0, "duplicate_file": True, "statement_id": existing_statement.id}

    try:
        rows = parser.parse_statement(file.filename or "", content)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    statement = models.Statement(
        account_id=account_id,
        source_file=file.filename,
        hash=file_hash,
        parsed_status="parsed",
    )
    db.add(statement)
    db.flush()

    created = 0
    skipped = 0
    for r in rows:
        checksum = parser.row_checksum(account_id, r)
        if db.query(models.Transaction).filter_by(account_id=account_id, checksum=checksum).first():
            skipped += 1
            continue

        cat_name = categorize(r.get("narration"), r.get("merchant"))
        cat_id = None
        if cat_name:
            cat = db.query(models.Category).filter_by(name=cat_name).first()
            if not cat:
                cat = models.Category(name=cat_name)
                db.add(cat); db.flush()
            cat_id = cat.id
        txn = models.Transaction(
            account_id=account_id,
            category_id=cat_id,
            statement_id=statement.id,
            source="statement",
            checksum=checksum,
            **r,
        )
        db.add(txn)
        created += 1
    statement.imported_count = created
    db.commit()
    return {"imported": created, "skipped": skipped, "duplicate_file": False, "statement_id": statement.id}


@router.post("/import-csv")
async def import_csv(account_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not (file.filename or "").lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed on this compatibility endpoint")
    return await import_statement(account_id, file, db)
