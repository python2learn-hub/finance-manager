from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..schemas import AccountIn, AccountOut

router = APIRouter()


@router.post("/", response_model=AccountOut)
def create_account(payload: AccountIn, db: Session = Depends(get_db)):
    account = models.Account(**payload.model_dump())
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


@router.get("/", response_model=list[AccountOut])
def list_accounts(db: Session = Depends(get_db)):
    return db.query(models.Account).order_by(models.Account.name).all()


@router.get("/{account_id}", response_model=AccountOut)
def get_account(account_id: int, db: Session = Depends(get_db)):
    account = db.get(models.Account, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account
