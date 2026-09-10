"""Ed25519 signing: every audit event is authenticated.

Each stakeholder owns a keypair derived deterministically from
HASHCHAIN_SECRET + actor_id (demo key store). Private keys live as PEM
files under STORAGE_DIR/keys and are NEVER stored in the database —
only public verification keys are stored on the actor row.
"""

import base64
import hashlib
from pathlib import Path

from nacl.encoding import HexEncoder
from nacl.signing import SigningKey, VerifyKey

from app.core.config import get_settings


def _seed_for_actor(actor_id: str) -> bytes:
    settings = get_settings()
    return hashlib.sha256(f"ed25519|{settings.HASHCHAIN_SECRET}|{actor_id}".encode()).digest()


def keypair_for_actor(actor_id: str) -> tuple[SigningKey, VerifyKey]:
    return SigningKey(_seed_for_actor(actor_id)), SigningKey(_seed_for_actor(actor_id)).verify_key


def public_key_hex(actor_id: str) -> str:
    _, vk = keypair_for_actor(actor_id)
    return vk.encode(encoder=HexEncoder).decode()


def ensure_key_files(actor_id: str) -> dict[str, str]:
    """Persist PEM-style hex key files to the local key store (best effort)."""
    settings = get_settings()
    keys_dir = Path(settings.STORAGE_DIR) / "keys"
    keys_dir.mkdir(parents=True, exist_ok=True)
    safe = "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in actor_id)
    sk, vk = keypair_for_actor(actor_id)
    priv = keys_dir / f"{safe}.priv.hex"
    pub = keys_dir / f"{safe}.pub.hex"
    if not priv.exists():
        priv.write_text(sk.encode(encoder=HexEncoder).decode())
        try:
            priv.chmod(0o600)
        except OSError:
            pass
    if not pub.exists():
        pub.write_text(vk.encode(encoder=HexEncoder).decode())
    return {"private": str(priv), "public": str(pub)}


def sign_hash(actor_id: str, event_hash_hex: str) -> str:
    """signature = Sign(private_key, event_hash) -> base64."""
    sk, _ = keypair_for_actor(actor_id)
    signed = sk.sign(bytes.fromhex(event_hash_hex))
    return base64.b64encode(signed.signature).decode()


def verify_signature(public_key_hex_: str, event_hash_hex: str, signature_b64: str) -> bool:
    """Verify(public_key, event_hash, signature)."""
    try:
        vk = VerifyKey(public_key_hex_, encoder=HexEncoder)
        vk.verify(bytes.fromhex(event_hash_hex), base64.b64decode(signature_b64))
        return True
    except Exception:
        return False
