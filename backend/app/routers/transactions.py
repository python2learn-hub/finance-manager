from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models
from ..schemas import TransactionIn, TransactionOut, TransactionView
from ..services.categorizer import categorize

router = APIRouter()


def _get_or_create_category(db: Session, category_name: Optional[str]) -> Optional[int]:
    if not category_name:
        return None
    cat = db.query(models.Category).filter_by(name=category_name).first()
    if not cat:
        cat = models.Category(name=category_name)
        db.add(cat)
        db.flush()
    return cat.id


@router.post("/", response_model=TransactionOut)
def add_transaction(payload: TransactionIn, db: Session = Depends(get_db)):
    # auto-category if not provided
    if payload.category_id is None:
        category_id = _get_or_create_category(db, categorize(payload.narration, payload.merchant, payload.direction))
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
        tags=payload.tags,
    )
    db.add(txn); db.commit(); db.refresh(txn)
    return txn


@router.post("/recategorize")
def recategorize_transactions(account_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(models.Transaction)
    if account_id:
        query = query.filter(models.Transaction.account_id == account_id)

    updated = 0
    for txn in query.all():
        category_id = _get_or_create_category(db, categorize(txn.narration, txn.merchant, txn.direction))
        if txn.category_id != category_id:
            txn.category_id = category_id
            updated += 1
    db.commit()
    return {"updated": updated}


@router.get("/", response_model=list[TransactionView])
def list_transactions(
    account_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    direction: Optional[str] = None,
    category_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    query = db.query(models.Transaction)
    if account_id:
        query = query.filter(models.Transaction.account_id == account_id)
    if start_date:
        query = query.filter(models.Transaction.txn_date >= start_date)
    if end_date:
        query = query.filter(models.Transaction.txn_date <= end_date)
    if direction:
        query = query.filter(models.Transaction.direction == direction)
    if category_id:
        query = query.filter(models.Transaction.category_id == category_id)

    txns = query.order_by(models.Transaction.txn_date.desc(), models.Transaction.id.desc()).limit(500).all()
    return [
        TransactionView(
            id=txn.id,
            account_id=txn.account_id,
            account_name=txn.account.name if txn.account else None,
            txn_date=txn.txn_date,
            amount=txn.amount,
            direction=txn.direction,
            merchant=txn.merchant,
            narration=txn.narration,
            category_id=txn.category_id,
            category_name=txn.category.name if txn.category else None,
            source=txn.source,
            tags=txn.tags,
        )
        for txn in txns
    ]
