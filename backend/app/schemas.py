from pydantic import BaseModel, Field
from datetime import date
from typing import Optional

class TransactionIn(BaseModel):
    account_id: int
    txn_date: date
    amount: float
    direction: str = Field(pattern="^(debit|credit)$")
    merchant: Optional[str] = None
    narration: Optional[str] = None
    category_id: Optional[int] = None
    tags: Optional[str] = None

class TransactionOut(TransactionIn):
    id: int
    class Config:
        from_attributes = True
