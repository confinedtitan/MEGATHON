import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
  verify,
  type KeyObject,
} from "crypto";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import path from "path";

// ── Ed25519 signing-key management ──────────────────────────────
// Each stakeholder signs audit-event hashes with its own Ed25519 key.
// Keys are derived deterministically from a server-side secret plus the
// actor id, so they are reproducible in this demo environment without
// EVER storing private keys in the database. PEM copies are kept in a
// local key store on disk (storage/keys). Only public verification keys
// are stored in PostgreSQL (actors.public_key).
//
// Production: set HASHCHAIN_SECRET to a strong random value and back it
// up securely (HSM / KMS). Every actor would hold its own private key.

const SECRET = process.env.HASHCHAIN_SECRET || "dev-only-secret-change-in-production";
const KEYS_DIR = path.join(process.cwd(), "storage", "keys");

// PKCS#8 DER prefix for an Ed25519 private key (RFC 8410):
// SEQUENCE { INTEGER 0, SEQUENCE { OID 1.3.101.112 }, OCTET STRING <32-byte seed> }
const ED25519_PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");

export function actorKeypair(actorId: string): {
  privateKey: KeyObject;
  publicKey: KeyObject;
  publicKeyPem: string;
  privateKeyPem: string;
} {
  const seed = createHash("sha256").update(`ed25519|${SECRET}|${actorId}`).digest();
  const privateKey = createPrivateKey({
    key: Buffer.concat([ED25519_PKCS8_PREFIX, seed]),
    format: "der",
    type: "pkcs8",
  });
  const publicKey = createPublicKey(privateKey);
  const publicKeyPem = publicKey.export({ format: "pem", type: "spki" }) as string;
  const privateKeyPem = privateKey.export({ format: "pem", type: "pkcs8" }) as string;

  // Persist to the local key store (best effort — never in the database)
  try {
    mkdirSync(KEYS_DIR, { recursive: true });
    const safe = actorId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const privPath = path.join(KEYS_DIR, `${safe}.priv.pem`);
    const pubPath = path.join(KEYS_DIR, `${safe}.pub.pem`);
    if (!existsSync(privPath)) writeFileSync(privPath, privateKeyPem, { mode: 0o600 });
    if (!existsSync(pubPath)) writeFileSync(pubPath, publicKeyPem);
  } catch {
    /* read-only filesystem — keys remain derivable from the secret */
  }

  return { privateKey, publicKey, publicKeyPem, privateKeyPem };
}

/** signature = Sign(private_key, event_hash) — base64 encoded */
export function signHash(actorId: string, eventHashHex: string): string {
  const { privateKey } = actorKeypair(actorId);
  return sign(null, Buffer.from(eventHashHex, "hex"), privateKey).toString("base64");
}

/** Verify(public_key, event_hash, signature) */
export function verifyHashSignature(
  publicKeyPem: string,
  eventHashHex: string,
  signatureB64: string
): boolean {
  try {
    const pub = createPublicKey(publicKeyPem);
    return verify(
      null,
      Buffer.from(eventHashHex, "hex"),
      pub,
      Buffer.from(signatureB64, "base64")
    );
  } catch {
    return false;
  }
}
