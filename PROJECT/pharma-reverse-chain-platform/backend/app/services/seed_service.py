"""Idempotent demo seed: actors + users + 10 batches + signed history."""

from datetime import date

from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.crypto.hashchain import sha256_hex
from app.crypto.signatures import ensure_key_files, public_key_hex
from app.db.models import Actor, AuditEvent, FraudAlert, MedicineBatch, User
from app.seed_data import ACTOR_FOR_STATE, SEED_ACTORS, SEED_BATCHES, SEED_USERS, path_to
from app.services.audit_service import append_audit_event, resolve_actor
from app.services.lifecycle import EVENT_FOR_STATE


def seed_all(db: Session) -> dict:
    db.query(FraudAlert).delete()
    db.query(AuditEvent).delete()
    db.query(MedicineBatch).delete()
    db.query(User).delete()
    db.query(Actor).delete()
    db.commit()

    for a in SEED_ACTORS:
        db.add(Actor(actor_id=a["actor_id"], name=a["name"], role=a["role"], location=a["location"], public_key=public_key_hex(a["actor_id"])))
    db.commit()
    for a in SEED_ACTORS:
        ensure_key_files(a["actor_id"])

    for u in SEED_USERS:
        db.add(User(username=u["username"], password_hash=hash_password(u["password"]), role=u["role"], actor_id=u["actor_id"], name=u["name"], is_active=True))
    db.commit()

    for b in SEED_BATCHES:
        batch = MedicineBatch(
            batch_number=b["batch_number"],
            medicine_name=b["medicine_name"],
            manufacturer_name=b["manufacturer_name"],
            expiry_date=date.fromisoformat(b["expiry_date"]),
            quantity=b["quantity"],
            current_status="ACTIVE",
        )
        db.add(batch)
        db.commit()
        db.refresh(batch)
        maker = resolve_actor(db, b["manufacturer_name"], "Manufacturer")
        append_audit_event(
            db, batch=batch, event_type="BATCH_CREATED", actor=maker,
            from_state="GENESIS", to_state="ACTIVE",
            remarks=f"Batch {b['batch_number']} manufactured and released",
            extra={"medicine_name": b["medicine_name"], "quantity": b["quantity"]},
            update_status=False,
        )
        current = "ACTIVE"
        for nxt in path_to(b["target"]):
            role, name, remarks = ACTOR_FOR_STATE[nxt]
            actor = resolve_actor(db, name, role)
            extra: dict = {}
            event_type = EVENT_FOR_STATE.get(nxt, nxt)
            if nxt == "DISPUTED":
                event_type = "QUANTITY_DISCREPANCY"
                extra = {"expected_quantity": b["quantity"], "received_quantity": b["quantity"] - 150, "difference": 150}
            if nxt == "DESTROYED":
                extra = {"certificate_hash": sha256_hex(f"destruction-certificate-{b['batch_number']}"), "certificate_filename": f"destruction-cert-{b['batch_number']}.pdf", "status": "DESTROYED"}
            append_audit_event(db, batch=batch, event_type=event_type, actor=actor, from_state=current, to_state=nxt, remarks=remarks, extra=extra)
            current = nxt
        if b["target"] == "DISPUTED":
            batch.discrepancy_reason = "Quantity mismatch: counted 2,850 vs declared 3,000"
        if b["target"] == "DESTROYED":
            batch.certificate_hash = sha256_hex(f"destruction-certificate-{b['batch_number']}")
            batch.certificate_filename = f"destruction-cert-{b['batch_number']}.pdf"
        db.commit()

    target = db.query(MedicineBatch).filter(MedicineBatch.batch_number == "NV-CET-1008").first()
    if target:
        alert = FraudAlert(batch_number="NV-CET-1008", pharmacy_name="GreenCross Pharmacy", batch_status="DESTROYED")
        db.add(alert)
        db.commit()
        db.refresh(alert)
        actor = resolve_actor(db, "GreenCross Pharmacy", "Pharmacy")
        append_audit_event(
            db, batch=target, event_type="SALE_BLOCKED", actor=actor,
            from_state="DESTROYED", to_state="DESTROYED",
            remarks="POS sale blocked at GreenCross Pharmacy — batch is DESTROYED",
            extra={"pharmacy_name": "GreenCross Pharmacy", "batch_status": "DESTROYED", "alert_id": alert.alert_id, "reason": "BATCH_NOT_ELIGIBLE_FOR_SALE"},
            update_status=False,
        )

    return {
        "actors": db.query(Actor).count(),
        "users": db.query(User).count(),
        "batches": db.query(MedicineBatch).count(),
        "auditEvents": db.query(AuditEvent).count(),
        "alerts": db.query(FraudAlert).count(),
    }
