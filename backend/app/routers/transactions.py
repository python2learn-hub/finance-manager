from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models
from ..schemas import TransactionIn, TransactionOut
from ..services.categorizer import categorize

router = APIRouter()

@router.post("/", response_model=TransactionOut)
def add_transaction(payload: TransactionIn, db: Session = Depends(get_db)):
    # auto-category if not provided
    if payload.category_id is None:
        category_name = categorize(payload.narration, payload.merchant)
        if category_name:
            cat = db.query(models.Category).filter_by(name=category_name).first()
            if not cat:
                cat = models.Category(name=category_name)
                db.add(cat); db.flush()
            category_id = cat.id
        else:
            category_id = None
    else:
        category_id = payload.category_id

    txn = models.Transaction(
        account_id=payload.account_id,
        txn_date=payload.txn_date,
        amount=payload.amount,
        direction=payload.direction,
        merchant=payload.merchant,
        narration=payload.narration,
        category_id=category_id,
    )
    db.add(txn); db.commit(); db.refresh(txn)
    return txn

@router.get("/", response_model=list[TransactionOut])
def list_transactions(db: Session = Depends(get_db)):
    return db.query(models.Transaction).order_by(models.Transaction.txn_date.desc()).limit(200).all()
