from collections import defaultdict
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

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
    query = db.query(models.Transaction).options(
        joinedload(models.Transaction.category),
        joinedload(models.Transaction.account),
    )
    if account_id:
        query = query.filter(models.Transaction.account_id == account_id)
    if start_date:
        query = query.filter(models.Transaction.txn_date >= start_date)
    if end_date:
        query = query.filter(models.Transaction.txn_date <= end_date)

    transactions = query.order_by(models.Transaction.txn_date.asc(), models.Transaction.id.asc()).all()
    debits = [txn for txn in transactions if txn.direction == "debit"]
    credits = [txn for txn in transactions if txn.direction == "credit"]

    spend = sum(t.amount for t in transactions if t.direction == "debit")
    income = sum(t.amount for t in transactions if t.direction == "credit")
    net = income - spend
    txn_dates = [txn.txn_date for txn in transactions]
    period_start = start_date or (min(txn_dates) if txn_dates else None)
    period_end = end_date or (max(txn_dates) if txn_dates else None)
    period_days = (period_end - period_start).days + 1 if period_start and period_end else 0

    categories = defaultdict(lambda: {"amount": 0.0, "count": 0})
    category_breakdown = defaultdict(lambda: {"debit": 0.0, "credit": 0.0, "count": 0})
    merchants = defaultdict(lambda: {"amount": 0.0, "count": 0})
    income_sources = defaultdict(lambda: {"amount": 0.0, "count": 0})
    monthly = defaultdict(lambda: {"debit": 0.0, "credit": 0.0, "count": 0})
    daily_spend = defaultdict(float)
    categorized_count = 0
    uncategorized_count = 0
    uncategorized_spend = 0.0

    for txn in transactions:
        month_key = (txn.txn_date.year, txn.txn_date.month)
        monthly[month_key][txn.direction] += txn.amount
        monthly[month_key]["count"] += 1
        category = txn.category.name if txn.category else "Uncategorized"
        category_breakdown[category][txn.direction] += txn.amount
        category_breakdown[category]["count"] += 1
        if txn.category:
            categorized_count += 1
        else:
            uncategorized_count += 1

        if txn.direction != "debit":
            source = txn.merchant or (txn.narration[:80] if txn.narration else "Unknown")
            income_sources[source]["amount"] += txn.amount
            income_sources[source]["count"] += 1
            continue
        categories[category]["amount"] += txn.amount
        categories[category]["count"] += 1
        if not txn.category:
            uncategorized_spend += txn.amount
        merchant = txn.merchant or (txn.narration[:80] if txn.narration else "Unknown")
        merchants[merchant]["amount"] += txn.amount
        merchants[merchant]["count"] += 1
        daily_spend[txn.txn_date] += txn.amount

    largest_debit = max(debits, key=lambda txn: txn.amount, default=None)
    largest_credit = max(credits, key=lambda txn: txn.amount, default=None)
    top_categories = sorted(categories.items(), key=lambda item: item[1]["amount"], reverse=True)[:10]
    category_rows = sorted(category_breakdown.items(), key=lambda item: item[1]["debit"], reverse=True)
    top_merchants = sorted(merchants.items(), key=lambda item: item[1]["amount"], reverse=True)[:10]
    top_income_sources = sorted(income_sources.items(), key=lambda item: item[1]["amount"], reverse=True)[:10]
    recent = sorted(transactions, key=lambda txn: (txn.txn_date, txn.id), reverse=True)[:12]

    return {
        "period": {
            "start": period_start.isoformat() if period_start else None,
            "end": period_end.isoformat() if period_end else None,
            "days": period_days,
        },
        "kpis": {
            "spend": round(spend, 2),
            "income": round(income, 2),
            "net_cashflow": round(net, 2),
            "transaction_count": len(transactions),
            "debit_count": len(debits),
            "credit_count": len(credits),
            "average_debit": round(spend / max(1, len(debits)), 2),
            "average_credit": round(income / max(1, len(credits)), 2),
            "average_daily_spend": round(spend / max(1, period_days), 2),
            "monthly_run_rate": round((spend / max(1, period_days)) * 30, 2),
            "largest_expense": round(largest_debit.amount, 2) if largest_debit else 0,
            "largest_income": round(largest_credit.amount, 2) if largest_credit else 0,
            "savings_rate": round((net / income) * 100, 1) if income else 0,
            "category_count": len(categories),
            "categorized_count": categorized_count,
            "uncategorized_count": uncategorized_count,
            "uncategorized_spend": round(uncategorized_spend, 2),
            "category_coverage": round((categorized_count / len(transactions)) * 100, 1) if transactions else 0,
        },
        "largest_expense": {
            "id": largest_debit.id,
            "date": largest_debit.txn_date.isoformat(),
            "merchant": largest_debit.merchant,
            "narration": largest_debit.narration,
            "amount": largest_debit.amount,
            "category": largest_debit.category.name if largest_debit.category else None,
        } if largest_debit else None,
        "top_categories": [
            {
                "category": category,
                "amount": round(values["amount"], 2),
                "count": values["count"],
                "share": round((values["amount"] / spend) * 100, 1) if spend else 0,
            }
            for category, values in top_categories
        ],
        "top_merchants": [
            {
                "merchant": merchant,
                "amount": round(values["amount"], 2),
                "count": values["count"],
            }
            for merchant, values in top_merchants
        ],
        "top_income_sources": [
            {
                "source": source,
                "amount": round(values["amount"], 2),
                "count": values["count"],
            }
            for source, values in top_income_sources
        ],
        "category_breakdown": [
            {
                "category": category,
                "debit": round(values["debit"], 2),
                "credit": round(values["credit"], 2),
                "net": round(values["credit"] - values["debit"], 2),
                "count": values["count"],
                "share": round((values["debit"] / spend) * 100, 1) if spend else 0,
            }
            for category, values in category_rows
        ],
        "monthly": [
            {
                "year": year,
                "month": month,
                "label": f"{date(year, month, 1):%b %Y}",
                "debit": round(values["debit"], 2),
                "credit": round(values["credit"], 2),
                "net": round(values["credit"] - values["debit"], 2),
                "count": values["count"],
            }
            for (year, month), values in sorted(monthly.items())
        ],
        "daily_spend": [
            {"date": day.isoformat(), "amount": round(amount, 2)}
            for day, amount in sorted(daily_spend.items())
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
