from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import extract, func
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db

router = APIRouter()


@router.get("/summary")
def dashboard_summary(
    account_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
):
    query = db.query(models.Transaction)
    if account_id:
        query = query.filter(models.Transaction.account_id == account_id)
    if start_date:
        query = query.filter(models.Transaction.txn_date >= start_date)
    if end_date:
        query = query.filter(models.Transaction.txn_date <= end_date)

    transactions = query.all()
    spend = sum(t.amount for t in transactions if t.direction == "debit")
    income = sum(t.amount for t in transactions if t.direction == "credit")
    net = income - spend

    top_categories = (
        query.with_entities(
            func.coalesce(models.Category.name, "Uncategorized").label("category"),
            func.sum(models.Transaction.amount).label("amount"),
        )
        .outerjoin(models.Category, models.Category.id == models.Transaction.category_id)
        .filter(models.Transaction.direction == "debit")
        .group_by(func.coalesce(models.Category.name, "Uncategorized"))
        .order_by(func.sum(models.Transaction.amount).desc())
        .limit(8)
        .all()
    )

    monthly = (
        query.with_entities(
            extract("year", models.Transaction.txn_date).label("year"),
            extract("month", models.Transaction.txn_date).label("month"),
            models.Transaction.direction,
            func.sum(models.Transaction.amount).label("amount"),
        )
        .group_by("year", "month", models.Transaction.direction)
        .order_by("year", "month")
        .all()
    )

    recent = (
        query.order_by(models.Transaction.txn_date.desc(), models.Transaction.id.desc())
        .limit(10)
        .all()
    )

    return {
        "kpis": {
            "spend": round(spend, 2),
            "income": round(income, 2),
            "net_cashflow": round(net, 2),
            "transaction_count": len(transactions),
            "average_debit": round(spend / max(1, len([t for t in transactions if t.direction == "debit"])), 2),
        },
        "top_categories": [{"category": row.category, "amount": float(row.amount or 0)} for row in top_categories],
        "monthly": [
            {
                "year": int(row.year),
                "month": int(row.month),
                "direction": row.direction,
                "amount": float(row.amount or 0),
            }
            for row in monthly
        ],
        "recent": [
            {
                "id": txn.id,
                "date": txn.txn_date.isoformat(),
                "merchant": txn.merchant,
                "narration": txn.narration,
                "direction": txn.direction,
                "amount": txn.amount,
                "category": txn.category.name if txn.category else None,
            }
            for txn in recent
        ],
    }
