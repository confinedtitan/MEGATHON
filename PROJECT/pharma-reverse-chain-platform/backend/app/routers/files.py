"""Local file storage for destruction certificates (+ photos).

Saves the exact file, computes SHA-256, pins the hash on the batch so the
signed DESTRUCTION_VERIFIED event can embed it.
"""

from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.deps import get_db, require_roles
from app.crypto.hashchain import sha256_bytes
from app.db.models import MedicineBatch, User

router = APIRouter(tags=["files"])
MAX_BYTES = 10 * 1024 * 1024


@router.post("/batch/{batch_id}/certificate-file")
def upload_certificate(
    batch_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("Manufacturer", "Regulator")),
):
    batch = db.query(MedicineBatch).filter(MedicineBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    data = file.file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 10 MB)")
    digest = sha256_bytes(data)
    settings = get_settings()
    dest_dir = Path(settings.STORAGE_DIR) / "certificates" / str(batch_id)
    dest_dir.mkdir(parents=True, exist_ok=True)
    safe = "".join(c if c.isalnum() or c in ("-", "_", ".") else "_" for c in (file.filename or "certificate.pdf"))
    from datetime import datetime

    stored = f"{int(datetime.now().timestamp())}-{safe}"
    (dest_dir / stored).write_bytes(data)
    batch.certificate_hash = digest
    batch.certificate_filename = stored
    db.commit()
    db.refresh(batch)
    return {"certificate_hash": digest, "certificate_filename": stored, "size_bytes": len(data), "batch_id": batch.batch_number}
