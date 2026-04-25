from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models
from ..schemas import CategoryOut, TransactionCategoryUpdate, TransactionIn, TransactionOut, TransactionView
from ..services.categorizer import categorize

router = APIRouter()


def _get_or_create_category(db: Session, category_name: Optional[str]) -> Optional[int]:
    if not category_name:
        return None
    category_name = category_name.strip()
    if not category_name:
        return None
    cat = db.query(models.Category).filter_by(name=category_name).first()
    if not cat:
        cat = models.Category(name=category_name)
        db.add(cat)
        db.flush()
    return cat.id


def _transaction_view(txn: models.Transaction) -> TransactionView:
    return TransactionView(
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
def recategorize_transactions(
    account_id: Optional[int] = None,
    only_uncategorized: bool = False,
    db: Session = Depends(get_db),
):
    query = db.query(models.Transaction)
    if account_id:
        query = query.filter(models.Transaction.account_id == account_id)
    if only_uncategorized:
        query = query.filter(models.Transaction.category_id.is_(None))

    updated = 0
    for txn in query.all():
        category_id = _get_or_create_category(db, categorize(txn.narration, txn.merchant, txn.direction))
        if txn.category_id != category_id:
            txn.category_id = category_id
            updated += 1
    db.commit()
    return {"updated": updated}


@router.get("/categories", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    return db.query(models.Category).order_by(models.Category.name).all()


@router.patch("/{transaction_id}/category", response_model=TransactionView)
def update_transaction_category(
    transaction_id: int,
    payload: TransactionCategoryUpdate,
    db: Session = Depends(get_db),
):
    txn = db.get(models.Transaction, transaction_id)
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if payload.category_id is not None:
        category = db.get(models.Category, payload.category_id)
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")
        txn.category_id = category.id
    elif payload.category_name is not None:
        txn.category_id = _get_or_create_category(db, payload.category_name)
    else:
        txn.category_id = None

    db.commit()
    db.refresh(txn)
    return _transaction_view(txn)


@router.get("/", response_model=list[TransactionView])
def list_transactions(
    account_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    direction: Optional[str] = None,
    category_id: Optional[int] = None,
    uncategorized: Optional[bool] = None,
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
    if uncategorized is True:
        query = query.filter(models.Transaction.category_id.is_(None))
    elif uncategorized is False:
        query = query.filter(models.Transaction.category_id.is_not(None))

    txns = query.order_by(models.Transaction.txn_date.desc(), models.Transaction.id.desc()).limit(500).all()
    return [_transaction_view(txn) for txn in txns]
