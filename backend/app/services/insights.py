from sqlalchemy.orm import Session
from sqlalchemy import func
from ..models import Transaction

def month_spend(db: Session, year: int, month: int):
    q = (
        db.query(func.sum(Transaction.amount))
        .filter(func.extract('year', Transaction.txn_date) == year)
        .filter(func.extract('month', Transaction.txn_date) == month)
        .filter(Transaction.direction == "debit")
    )
    return {"year": year, "month": month, "debit_sum": float(q.scalar() or 0.0)}
