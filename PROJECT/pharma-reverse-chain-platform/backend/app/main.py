from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.deps import get_db, require_roles
from app.db.database import Base, engine
from app.db.models import User  # noqa: F401 (register models)
from app.routers import alerts, audit, auth, batches, files, verify

settings = get_settings()
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Pharma Reverse Chain — Compliance API (Option B)",
    description="React + FastAPI + PostgreSQL. Cryptographic audit ledger: SHA-256 hash chain + Ed25519 signatures. No blockchain.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins + ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(batches.router)
app.include_router(audit.router)
app.include_router(verify.router)
app.include_router(alerts.router)
app.include_router(files.router)


@app.get("/health")
def health():
    return {"ok": True, "ledger": "hash-chain", "signatures": "ed25519"}


@app.get("/stats")
def stats(db: Session = Depends(get_db), user: User = Depends(require_roles("Regulator", "Manufacturer", "Distributor", "Pharmacy"))):
    from app.db.models import AuditEvent, FraudAlert, MedicineBatch

    batches = db.query(MedicineBatch).all()
    by_status: dict[str, int] = {}
    for b in batches:
        by_status[b.current_status] = by_status.get(b.current_status, 0) + 1
    return {
        "totalBatches": len(batches),
        "byStatus": by_status,
        "totalAuditEvents": db.query(AuditEvent).count(),
        "totalAlerts": db.query(FraudAlert).count(),
        "blockedBatches": len([b for b in batches if b.current_status != "ACTIVE"]),
        "sellableBatches": len([b for b in batches if b.current_status == "ACTIVE"]),
    }


@app.post("/seed")
def seed(db: Session = Depends(get_db)):
    from app.services.seed_service import seed_all

    return {"seeded": True, "counts": seed_all(db)}
