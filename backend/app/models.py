from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey, Boolean, JSON
from sqlalchemy.orm import relationship
from .database import Base

class Account(Base):
    __tablename__ = "accounts"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)  # bank | credit | broker | wallet
    currency = Column(String, default="INR")
    transactions = relationship("Transaction", back_populates="account")

class Statement(Base):
    __tablename__ = "statements"
    id = Column(Integer, primary_key=True)
    account_id = Column(Integer, ForeignKey("accounts.id"))
    period_start = Column(Date)
    period_end = Column(Date)
    source_file = Column(String)
    hash = Column(String, unique=True)
    parsed_status = Column(String, default="pending")
    imported_count = Column(Integer, default=0)

class Category(Base):
    __tablename__ = "categories"
    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, nullable=False)
    parent_id = Column(Integer, ForeignKey("categories.id"), nullable=True)

class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    txn_date = Column(Date, nullable=False)
    posted_date = Column(Date, nullable=True)
    amount = Column(Float, nullable=False)
    direction = Column(String, nullable=False)  # debit | credit
    merchant = Column(String)
    narration = Column(String)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    source = Column(String, default="manual")
    statement_id = Column(Integer, ForeignKey("statements.id"), nullable=True)
    checksum = Column(String, index=True)
    is_recurring = Column(Boolean, default=False)
    tags = Column(String)
    metadata_ = Column("metadata", JSON)

    account = relationship("Account", back_populates="transactions")
    category = relationship("Category")
