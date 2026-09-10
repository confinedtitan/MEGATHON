from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.db.models import Actor, FraudAlert, MedicineBatch, User
from app.schemas.verify import VerifyRequest
from app.services.audit_service import append_audit_event, resolve_actor
from app.services.lifecycle import NON_SELLABLE

router = APIRouter(tags=["verify"])


@router.post("/verify-batch")
def verify_batch(body: VerifyRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    batch_number = (body.batch_id or "").strip()
    pharmacy_name = (body.pharmacy_name or "").strip()
    if body.pharmacy_id and not pharmacy_name:
        actor = db.query(Actor).filter(Actor.actor_id == body.pharmacy_id).first()
        if actor:
            pharmacy_name = actor.name
    if not pharmacy_name:
        pharmacy_name = user.name if user.role == "Pharmacy" else "Unknown Pharmacy"
    if not batch_number:
        return {"allowed": False, "reason": "BATCH_ID_REQUIRED"}

    batch = db.query(MedicineBatch).filter(MedicineBatch.batch_number == batch_number).first()
    if not batch:
        return {"allowed": False, "reason": "BATCH_NOT_FOUND", "message": "Batch not found", "batch_id": batch_number}
    status = batch.current_status
    if status == "ACTIVE":
        return {"allowed": True, "batch_id": batch_number, "medicine_name": batch.medicine_name, "status": status, "message": "SALE ALLOWED — batch is ACTIVE"}
    if status in NON_SELLABLE:
        alert = FraudAlert(batch_number=batch_number, pharmacy_name=pharmacy_name, batch_status=status)
        db.add(alert)
        db.commit()
        db.refresh(alert)
        actor = resolve_actor(db, pharmacy_name, "Pharmacy")
        append_audit_event(
            db, batch=batch, event_type="SALE_BLOCKED", actor=actor,
            from_state=status, to_state=status,
            remarks=f"POS sale blocked at {pharmacy_name} — batch is {status}",
            extra={"pharmacy_name": pharmacy_name, "batch_status": status, "alert_id": alert.alert_id, "reason": "BATCH_NOT_ELIGIBLE_FOR_SALE"},
            update_status=False,
        )
        return {"allowed": False, "reason": "BATCH_NOT_ELIGIBLE_FOR_SALE", "message": "Batch not eligible for sale", "batch_id": batch_number, "medicine_name": batch.medicine_name, "status": status, "alert_id": alert.alert_id}
    return {"allowed": False, "reason": "BATCH_NOT_ELIGIBLE_FOR_SALE", "message": "Batch not eligible for sale", "status": status}
