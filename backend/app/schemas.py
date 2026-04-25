from pydantic import BaseModel, Field
from datetime import date
from typing import Optional

class AccountIn(BaseModel):
    name: str
    type: str = Field(pattern="^(bank|credit|broker|wallet|cash)$")
    currency: str = "INR"

class AccountOut(AccountIn):
    id: int

    class Config:
        from_attributes = True

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

class TransactionView(BaseModel):
    id: int
    account_id: int
    account_name: Optional[str] = None
    txn_date: date
    amount: float
    direction: str
    merchant: Optional[str] = None
    narration: Optional[str] = None
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    source: Optional[str] = None
    tags: Optional[str] = None

class CategoryOut(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True

class TransactionCategoryUpdate(BaseModel):
    category_id: Optional[int] = None
    category_name: Optional[str] = None
