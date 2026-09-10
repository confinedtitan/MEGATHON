from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db, require_roles
from app.db.models import Actor, MedicineBatch, User
from app.schemas.batches import AuditEventOut, BatchCreate, BatchOut, TransitionRequest
from app.services.audit_service import actor_for_user, append_audit_event, batch_history, resolve_actor
from app.services.lifecycle import EVENT_FOR_STATE, check_transition

router = APIRouter(tags=["batches"])


def _out(batch: MedicineBatch) -> dict:
    return {
        "id": batch.id,
        "batch_number": batch.batch_number,
        "medicine_name": batch.medicine_name,
        "manufacturer_name": batch.manufacturer_name,
        "expiry_date": batch.expiry_date,
        "quantity": batch.quantity,
        "current_status": batch.current_status,
        "created_at": batch.created_at,
        "updated_at": batch.updated_at,
        "certificate_hash": batch.certificate_hash,
        "certificate_filename": batch.certificate_filename,
        "discrepancy_reason": batch.discrepancy_reason,
    }


@router.post("/batch", response_model=dict, status_code=201)
def create_batch(
    body: BatchCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("Manufacturer", "Regulator")),
):
    if db.query(MedicineBatch).filter(MedicineBatch.batch_number == body.batch_number).first():
        raise HTTPException(status_code=409, detail=f"Batch {body.batch_number} already exists")
    batch = MedicineBatch(
        batch_number=body.batch_number.strip(),
        medicine_name=body.medicine_name.strip(),
        manufacturer_name=(body.manufacturer_name or "NovaGen Labs").strip(),
        expiry_date=body.expiry_date,
        quantity=body.quantity,
        current_status="ACTIVE",
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)
    actor = actor_for_user(db, user)
    event = append_audit_event(
        db,
        batch=batch,
        event_type="BATCH_CREATED",
        actor=actor,
        from_state="GENESIS",
        to_state="ACTIVE",
        remarks="Batch created and released as ACTIVE",
        extra={"medicine_name": batch.medicine_name, "quantity": batch.quantity},
        update_status=False,
    )
    return {"batch": _out(batch), "audit_event": event.id}


@router.get("/batches")
def list_batches(
    status: str | None = Query(default=None),
    search: str | None = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(MedicineBatch).order_by(MedicineBatch.id.desc())
    if status:
        q = q.filter(MedicineBatch.current_status == status)
    rows = q.all()
    if search:
        s = search.lower()
        rows = [
            b
            for b in rows
            if s in b.batch_number.lower() or s in b.medicine_name.lower() or s in b.manufacturer_name.lower()
        ]
    return {"batches": [_out(b) for b in rows], "count": len(rows)}


@router.get("/batch/{batch_id}")
def get_batch(batch_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    batch = db.query(MedicineBatch).filter(MedicineBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return {"batch": _out(batch), "history": batch_history(db, batch.batch_number)}


@router.get("/batch/number/{batch_number}")
def get_batch_by_number(batch_number: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    batch = db.query(MedicineBatch).filter(MedicineBatch.batch_number == batch_number).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return {"batch": _out(batch), "history": batch_history(db, batch.batch_number)}


def _transition(
    db: Session,
    user: User,
    batch_id: int,
    to_state: str,
    body: TransitionRequest,
    event_type: str | None = None,
    extra: dict | None = None,
):
    batch = db.query(MedicineBatch).filter(MedicineBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    check_transition(batch.current_status, to_state)
    actor = actor_for_user(db, user)
    remarks = body.remarks or body.reason or body.resolution
    event = append_audit_event(
        db,
        batch=batch,
        event_type=event_type or EVENT_FOR_STATE.get(to_state, to_state),
        actor=actor,
        from_state=batch.current_status if False else None,  # placeholder, fixed below
        to_state=to_state,
        remarks=remarks,
        extra=extra,
    )
    return event


@router.post("/batch/{batch_id}/return")
def log_return(batch_id: int, body: TransitionRequest = TransitionRequest(), db: Session = Depends(get_db), user: User = Depends(require_roles("Pharmacy", "Regulator"))):
    batch = db.query(MedicineBatch).filter(MedicineBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    check_transition(batch.current_status, "LOGGED_FOR_RETURN")
    from_state = batch.current_status
    actor = actor_for_user(db, user)
    event = append_audit_event(db, batch=batch, event_type="LOGGED_FOR_RETURN", actor=actor, from_state=from_state, to_state="LOGGED_FOR_RETURN", remarks=body.remarks or body.reason or "Return logged")
    db.refresh(batch)
    return {"batch": _out(batch), "audit_event": event.id}


@router.post("/batch/{batch_id}/schedule-pickup")
def schedule_pickup(batch_id: int, body: TransitionRequest = TransitionRequest(), db: Session = Depends(get_db), user: User = Depends(require_roles("Distributor", "Regulator"))):
    batch = db.query(MedicineBatch).filter(MedicineBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    check_transition(batch.current_status, "PICKUP_SCHEDULED")
    from_state = batch.current_status
    actor = actor_for_user(db, user)
    event = append_audit_event(db, batch=batch, event_type="PICKUP_SCHEDULED", actor=actor, from_state=from_state, to_state="PICKUP_SCHEDULED", remarks=body.remarks or "Pickup scheduled")
    db.refresh(batch)
    return {"batch": _out(batch), "audit_event": event.id}


@router.post("/batch/{batch_id}/receive")
def receive(batch_id: int, body: TransitionRequest = TransitionRequest(), db: Session = Depends(get_db), user: User = Depends(require_roles("Distributor", "Regulator"))):
    batch = db.query(MedicineBatch).filter(MedicineBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    actor = actor_for_user(db, user)
    if body.received_quantity is not None and body.received_quantity != batch.quantity:
        check_transition(batch.current_status, "DISPUTED")
        from_state = batch.current_status
        reason = body.reason or body.remarks or f"Quantity mismatch: counted {body.received_quantity} vs declared {batch.quantity}"
        batch.discrepancy_reason = reason
        event = append_audit_event(
            db, batch=batch, event_type="QUANTITY_DISCREPANCY", actor=actor,
            from_state=from_state, to_state="DISPUTED", remarks=reason,
            extra={"expected_quantity": batch.quantity, "received_quantity": body.received_quantity, "difference": abs(batch.quantity - body.received_quantity)},
        )
        db.refresh(batch)
        return {"batch": _out(batch), "audit_event": event.id, "disputed": True}
    check_transition(batch.current_status, "RECEIVED_BY_DISTRIBUTOR")
    from_state = batch.current_status
    event = append_audit_event(
        db, batch=batch, event_type="RECEIVED_BY_DISTRIBUTOR", actor=actor,
        from_state=from_state, to_state="RECEIVED_BY_DISTRIBUTOR",
        remarks=body.remarks or f"Received {body.received_quantity if body.received_quantity is not None else batch.quantity} units — quantity verified OK",
        extra={"received_quantity": body.received_quantity if body.received_quantity is not None else batch.quantity},
    )
    db.refresh(batch)
    return {"batch": _out(batch), "audit_event": event.id, "disputed": False}


@router.post("/batch/{batch_id}/raise-dispute")
def raise_dispute(batch_id: int, body: TransitionRequest = TransitionRequest(), db: Session = Depends(get_db), user: User = Depends(require_roles("Distributor", "Regulator"))):
    batch = db.query(MedicineBatch).filter(MedicineBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    check_transition(batch.current_status, "DISPUTED")
    from_state = batch.current_status
    reason = body.reason or body.remarks or "Dispute raised"
    batch.discrepancy_reason = reason
    actor = actor_for_user(db, user)
    event = append_audit_event(db, batch=batch, event_type="DISPUTE_RAISED", actor=actor, from_state=from_state, to_state="DISPUTED", remarks=reason)
    db.refresh(batch)
    return {"batch": _out(batch), "audit_event": event.id}


@router.post("/batch/{batch_id}/resolve-dispute")
def resolve_dispute(batch_id: int, body: TransitionRequest = TransitionRequest(), db: Session = Depends(get_db), user: User = Depends(require_roles("Distributor", "Regulator"))):
    batch = db.query(MedicineBatch).filter(MedicineBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    check_transition(batch.current_status, "RECEIVED_BY_DISTRIBUTOR")
    from_state = batch.current_status
    resolution = body.resolution or body.remarks or "Dispute resolved — quantity reconciled"
    actor = actor_for_user(db, user)
    prior = batch.discrepancy_reason
    event = append_audit_event(
        db, batch=batch, event_type="DISPUTE_RESOLVED", actor=actor,
        from_state=from_state, to_state="RECEIVED_BY_DISTRIBUTOR", remarks=resolution,
        extra={"reconciliation": resolution, "prior_discrepancy": prior},
    )
    batch.discrepancy_reason = f"Resolved: {resolution}"
    db.commit()
    db.refresh(batch)
    return {"batch": _out(batch), "audit_event": event.id}


@router.post("/batch/{batch_id}/destruction-ready")
def destruction_ready(batch_id: int, body: TransitionRequest = TransitionRequest(), db: Session = Depends(get_db), user: User = Depends(require_roles("Manufacturer", "Regulator"))):
    batch = db.query(MedicineBatch).filter(MedicineBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    check_transition(batch.current_status, "WAITING_FOR_DESTRUCTION")
    from_state = batch.current_status
    actor = actor_for_user(db, user)
    event = append_audit_event(db, batch=batch, event_type="WAITING_FOR_DESTRUCTION", actor=actor, from_state=from_state, to_state="WAITING_FOR_DESTRUCTION", remarks=body.remarks or "Accepted for certified destruction")
    db.refresh(batch)
    return {"batch": _out(batch), "audit_event": event.id}


@router.post("/batch/{batch_id}/destroy")
def destroy(batch_id: int, body: TransitionRequest = TransitionRequest(), db: Session = Depends(get_db), user: User = Depends(require_roles("Manufacturer", "Regulator"))):
    batch = db.query(MedicineBatch).filter(MedicineBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    check_transition(batch.current_status, "DESTROYED")
    from_state = batch.current_status
    actor = actor_for_user(db, user)
    extra: dict = {"status": "DESTROYED"}
    if batch.certificate_hash:
        extra["certificate_hash"] = batch.certificate_hash
    if batch.certificate_filename:
        extra["certificate_filename"] = batch.certificate_filename
    event = append_audit_event(db, batch=batch, event_type="DESTRUCTION_VERIFIED", actor=actor, from_state=from_state, to_state="DESTROYED", remarks=body.remarks or "Destroyed under supervision. Certificate issued.", extra=extra)
    db.refresh(batch)
    return {"batch": _out(batch), "audit_event": event.id}


@router.post("/batch/{batch_id}/certificate")
def upload_certificate_placeholder(batch_id: int):
    # Real upload lives in files router (multipart). Kept for docs parity.
    return {"detail": "Use POST /batch/{id}/certificate-file with multipart field `file`."}
