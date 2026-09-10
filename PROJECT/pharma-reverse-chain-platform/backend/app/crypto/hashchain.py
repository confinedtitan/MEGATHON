"""SHA-256 hash-chain generation + certificate hashing."""

import hashlib
from typing import Any

from app.crypto.canonical import canonical_json

GENESIS_HASH = "GENESIS"


def sha256_hex(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def compute_event_hash(
    *,
    batch_id: str,
    event_type: str,
    event_data: dict[str, Any],
    actor_id: str,
    timestamp_iso: str,
    previous_hash: str,
) -> str:
    """event_hash = SHA256(batch_id | event_type | canonical(event_data)
    | actor_id | timestamp | previous_hash). Deterministic and reproducible."""
    canonical = "|".join(
        [
            batch_id,
            event_type,
            canonical_json(event_data),
            actor_id,
            timestamp_iso,
            previous_hash,
        ]
    )
    return sha256_hex(canonical)
