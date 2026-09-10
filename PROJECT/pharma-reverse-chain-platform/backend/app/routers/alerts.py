from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.db.models import FraudAlert, User

router = APIRouter(tags=["alerts"])


@router.get("/alerts")
def list_alerts(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.query(FraudAlert).order_by(FraudAlert.alert_id.desc()).limit(200).all()
    return {
        "alerts": [
            {"alert_id": a.alert_id, "batch_number": a.batch_number, "pharmacy_name": a.pharmacy_name, "timestamp": a.timestamp, "batch_status": a.batch_status}
            for a in rows
        ],
        "count": len(rows),
    }
