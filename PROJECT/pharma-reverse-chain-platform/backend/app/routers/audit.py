from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.db.models import Actor, AuditEvent, MedicineBatch, User
from app.services.audit_service import batch_history, verify_batch_integrity

router = APIRouter(tags=["audit"])


@router.get("/ledger")
def ledger(
    batch_id: str | None = Query(default=None),
    limit: int = Query(default=200, le=1000),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if batch_id:
        batch = db.query(MedicineBatch).filter(MedicineBatch.batch_number == batch_id).first()
        if not batch and batch_id.isdigit():
            batch = db.query(MedicineBatch).filter(MedicineBatch.id == int(batch_id)).first()
        if not batch:
            raise HTTPException(status_code=404, detail="Batch not found")
        events = batch_history(db, batch.batch_number)
        events_desc = list(reversed(events))
        v = verify_batch_integrity(db, batch.batch_number)
        integrity = {"valid": v.get("integrity_valid"), "events": v.get("events_verified", 0), "signatures": v.get("signatures_verified", 0)}
        if not v.get("integrity_valid"):
            integrity.update({"invalid_record_id": v.get("invalid_record_id")})
        return {"audit_events": events_desc, "count": len(events_desc), "integrity": integrity}

    rows = db.query(AuditEvent).order_by(AuditEvent.id.desc()).limit(limit).all()
    actors = {a.actor_id: a for a in db.query(Actor).all()}
    from app.services.audit_service import annotate
    asc_rows = list(reversed(rows))
    annotated = annotate(asc_rows, actors)
    annotated_desc = list(reversed(annotated))
    batch_ids = sorted({e.batch_id for e in db.query(AuditEvent.batch_id).distinct()})
    invalid = None
    for bid in batch_ids:
        v = verify_batch_integrity(db, bid)
        if not v.get("integrity_valid"):
            invalid = {"batch": bid, "record": v.get("invalid_record_id")}
            break
    return {
        "audit_events": annotated_desc,
        "count": len(annotated_desc),
        "integrity": {"valid": invalid is None, **({"invalid_batch": invalid["batch"], "invalid_record_id": invalid["record"]} if invalid else {})},
    }


@router.get("/batches/{batch_number}/verify-integrity")
def verify_integrity(batch_number: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    batch = db.query(MedicineBatch).filter(MedicineBatch.batch_number == batch_number).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    v = verify_batch_integrity(db, batch_number)
    if v.get("integrity_valid"):
        return {"batch_id": batch_number, "integrity_valid": True, "events_verified": v["events_verified"], "signatures_verified": v["signatures_verified"]}
    return {"batch_id": batch_number, "integrity_valid": False, "error": "HASH_CHAIN_TAMPER_DETECTED", "invalid_record_id": v.get("invalid_record_id")}
