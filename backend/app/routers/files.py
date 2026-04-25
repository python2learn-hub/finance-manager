from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models
from ..services import parser
from ..services.categorizer import categorize

router = APIRouter()

@router.post("/import-csv")
async def import_csv(account_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV supported in starter. Use 'date,amount,direction,merchant,narration'")
    content = await file.read()
    rows = parser.parse_csv(content)
    created = 0
    for r in rows:
        cat_name = categorize(r.get("narration"), r.get("merchant"))
        cat_id = None
        if cat_name:
            cat = db.query(models.Category).filter_by(name=cat_name).first()
            if not cat:
                cat = models.Category(name=cat_name)
                db.add(cat); db.flush()
            cat_id = cat.id
        txn = models.Transaction(account_id=account_id, category_id=cat_id, **r)
        db.add(txn)
        created += 1
    db.commit()
    return {"imported": created}
