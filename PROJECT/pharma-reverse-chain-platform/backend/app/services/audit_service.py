"""Append + verify the cryptographic audit ledger.

The audit trail is cryptographically tamper-evident: any modification,
deletion, insertion, or reordering of historical events will break the
hash chain and/or digital signature verification.
"""

from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.crypto.hashchain import GENESIS_HASH, compute_event_hash
from app.crypto.signatures import ensure_key_files, public_key_hex, sign_hash, verify_signature
from app.db.models import Actor, AuditEvent, MedicineBatch, User


def slug_actor_id(name: str, role: str) -> str:
    base = "".join(c if c.isalnum() else "_" for c in f"{role}_{name}".upper()).strip("_")
    while "__" in base:
        base = base.replace("__", "_")
    return (base or "UNKNOWN_001")[:80]


def resolve_actor(db: Session, name: str, role: str) -> Actor:
    actor = db.query(Actor).filter(Actor.name == name).first()
    if actor:
        if not actor.public_key:
            actor.public_key = public_key_hex(actor.actor_id)
            db.commit()
            db.refresh(actor)
        ensure_key_files(actor.actor_id)
        return actor
    actor_id = slug_actor_id(name, role)
    actor = db.query(Actor).filter(Actor.actor_id == actor_id).first()
    if actor is None:
        actor = Actor(
            actor_id=actor_id,
            name=name,
            role=role,
            location="—",
            public_key=public_key_hex(actor_id),
        )
        db.add(actor)
        db.commit()
        db.refresh(actor)
    ensure_key_files(actor.actor_id)
    return actor


def actor_for_user(db: Session, user: User) -> Actor:
    actor = db.query(Actor).filter(Actor.actor_id == user.actor_id).first()
    if actor is None:
        actor = Actor(
            actor_id=user.actor_id,
            name=user.name,
            role=user.role,
            location="—",
            public_key=public_key_hex(user.actor_id),
        )
        db.add(actor)
        db.commit()
        db.refresh(actor)
    ensure_key_files(actor.actor_id)
    return actor


def last_event_hash(db: Session, batch_number: str) -> str:
    row = (
        db.query(AuditEvent)
        .filter(AuditEvent.batch_id == batch_number)
        .order_by(AuditEvent.id.desc())
        .first()
    )
    return row.event_hash if row else GENESIS_HASH


def append_audit_event(
    db: Session,
    *,
    batch: MedicineBatch,
    event_type: str,
    actor: Actor,
    from_state: str | None = None,
    to_state: str | None = None,
    remarks: str | None = None,
    extra: dict[str, Any] | None = None,
    update_status: bool = True,
) -> AuditEvent:
    previous_hash = last_event_hash(db, batch.batch_number)
    now = datetime.now(timezone.utc)
    timestamp_iso = now.isoformat()
    event_data: dict[str, Any] = {"batch_number": batch.batch_number}
    if from_state:
        event_data["from_state"] = from_state
    if to_state:
        event_data["to_state"] = to_state
    if remarks:
        event_data["remarks"] = remarks
    if extra:
        event_data.update(extra)

    event_hash = compute_event_hash(
        batch_id=batch.batch_number,
        event_type=event_type,
        event_data=event_data,
        actor_id=actor.actor_id,
        timestamp_iso=timestamp_iso,
        previous_hash=previous_hash,
    )
    signature = sign_hash(actor.actor_id, event_hash)

    row = AuditEvent(
        batch_id=batch.batch_number,
        event_type=event_type,
        event_data=event_data,
        previous_hash=previous_hash,
        event_hash=event_hash,
        actor_id=actor.actor_id,
        actor_role=actor.role,
        digital_signature=signature,
        timestamp=now,
    )
    db.add(row)
    if update_status and to_state:
        batch.current_status = to_state
    db.commit()
    db.refresh(row)
    return row


def annotate(events: list[AuditEvent], actors_by_id: dict[str, Actor]) -> list[dict]:
    out: list[dict] = []
    expected_prev = GENESIS_HASH
    for e in events:
        ts_iso = e.timestamp.astimezone(timezone.utc).isoformat() if e.timestamp else ""
        recomputed = compute_event_hash(
            batch_id=e.batch_id,
            event_type=e.event_type,
            event_data=e.event_data or {},
            actor_id=e.actor_id,
            timestamp_iso=ts_iso,
            previous_hash=e.previous_hash,
        )
        hash_valid = recomputed == e.event_hash and e.previous_hash == expected_prev
        expected_prev = e.event_hash
        actor = actors_by_id.get(e.actor_id)
        sig_valid = (
            verify_signature(actor.public_key, e.event_hash, e.digital_signature)
            if actor and actor.public_key
            else False
        )
        out.append(
            {
                "id": e.id,
                "batch_id": e.batch_id,
                "event_type": e.event_type,
                "event_data": e.event_data,
                "previous_hash": e.previous_hash,
                "event_hash": e.event_hash,
                "actor_id": e.actor_id,
                "actor_role": e.actor_role,
                "actor_name": actor.name if actor else None,
                "digital_signature": e.digital_signature,
                "timestamp": e.timestamp,
                "hash_valid": hash_valid,
                "signature_valid": sig_valid,
            }
        )
    return out


def batch_history(db: Session, batch_number: str) -> list[dict]:
    rows = (
        db.query(AuditEvent)
        .filter(AuditEvent.batch_id == batch_number)
        .order_by(AuditEvent.id.asc())
        .all()
    )
    actors = {a.actor_id: a for a in db.query(Actor).all()}
    return annotate(rows, actors)


def verify_batch_integrity(db: Session, batch_number: str) -> dict:
    annotated = batch_history(db, batch_number)
    sigs = 0
    for e in annotated:
        if not e["hash_valid"]:
            return {
                "integrity_valid": False,
                "error": "HASH_CHAIN_TAMPER_DETECTED",
                "invalid_record_id": e["id"],
            }
        if not e["signature_valid"]:
            return {
                "integrity_valid": False,
                "error": "HASH_CHAIN_TAMPER_DETECTED",
                "invalid_record_id": e["id"],
            }
        sigs += 1
    return {
        "integrity_valid": True,
        "events_verified": len(annotated),
        "signatures_verified": sigs,
    }
