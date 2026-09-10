import { createHash } from "crypto";
import { db } from "@/db";
import { actors, auditEvents, medicineBatches } from "@/db/schema";
import { asc, desc, eq, sql } from "drizzle-orm";
import { actorKeypair, signHash, verifyHashSignature } from "@/lib/keystore";

export const GENESIS_HASH = "GENESIS";

// ── Canonical JSON ──────────────────────────────────────────────
// Recursively sorts object keys so the same event data always produces
// the same bytes — and therefore the same hash — regardless of key order
// (PostgreSQL JSONB also normalises ordering on read).
export function canonicalize(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0
    );
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

// ── Event hash ──────────────────────────────────────────────────
// event_hash = SHA256(batch_id | event_type | canonical(event_data)
//                      | actor_id | timestamp | previous_hash)
export function computeEventHash(args: {
  batchId: string;
  eventType: string;
  eventData: Record<string, unknown>;
  actorId: string;
  timestampISO: string;
  previousHash: string;
}): string {
  const canonical = [
    args.batchId,
    args.eventType,
    canonicalize(args.eventData),
    args.actorId,
    args.timestampISO,
    args.previousHash,
  ].join("|");
  return createHash("sha256").update(canonical).digest("hex");
}

export function slugActorId(name: string, role: string): string {
  const base = `${role}_${name}`
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 80);
  return base || "UNKNOWN_001";
}

export type ResolvedActor = {
  actorId: string;
  actorName: string;
  actorRole: string;
  publicKey: string;
};

/** Resolve (or auto-provision) the signing actor for an event. */
export async function resolveActor(
  actorName: string,
  actorRole: string
): Promise<ResolvedActor> {
  const found = await db.select().from(actors).where(eq(actors.name, actorName)).limit(1);
  if (found.length > 0) {
    let pub = found[0].publicKey;
    if (!pub) {
      pub = actorKeypair(found[0].actorId).publicKeyPem;
      await db.update(actors).set({ publicKey: pub }).where(eq(actors.id, found[0].id));
    }
    return {
      actorId: found[0].actorId,
      actorName: found[0].name,
      actorRole: found[0].role,
      publicKey: pub,
    };
  }
  const actorId = slugActorId(actorName, actorRole);
  const { publicKeyPem } = actorKeypair(actorId);
  const byId = await db.select().from(actors).where(eq(actors.actorId, actorId)).limit(1);
  if (byId.length === 0) {
    await db.insert(actors).values({
      actorId,
      name: actorName,
      role: actorRole,
      location: "—",
      publicKey: publicKeyPem,
    });
  }
  return { actorId, actorName, actorRole, publicKey: publicKeyPem };
}

export async function lastEventHash(batchNumber: string): Promise<string> {
  const rows = await db
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.batchId, batchNumber))
    .orderBy(desc(auditEvents.id))
    .limit(1);
  return rows.length > 0 ? rows[0].eventHash : GENESIS_HASH;
}

export type AuditAppendArgs = {
  batchDbId: number;
  batchNumber: string;
  eventType: string;
  fromState?: string | null;
  toState?: string | null;
  actorName: string;
  actorRole: string;
  remarks?: string | null;
  extra?: Record<string, unknown>;
  /** set false for non-transition events (e.g. SALE_BLOCKED) */
  updateStatus?: boolean;
};

/** Append one immutable, signed event to the hash chain. */
export async function appendAuditEvent(args: AuditAppendArgs) {
  const actor = await resolveActor(args.actorName, args.actorRole);
  const previousHash = await lastEventHash(args.batchNumber);
  const timestampISO = new Date().toISOString();
  const eventData: Record<string, unknown> = {
    batch_number: args.batchNumber,
    ...(args.fromState ? { from_state: args.fromState } : {}),
    ...(args.toState ? { to_state: args.toState } : {}),
    ...(args.remarks ? { remarks: args.remarks } : {}),
    ...(args.extra ?? {}),
  };
  const eventHash = computeEventHash({
    batchId: args.batchNumber,
    eventType: args.eventType,
    eventData,
    actorId: actor.actorId,
    timestampISO,
    previousHash,
  });
  const digitalSignature = signHash(actor.actorId, eventHash);

  const [row] = await db
    .insert(auditEvents)
    .values({
      batchId: args.batchNumber,
      eventType: args.eventType,
      eventData,
      previousHash,
      eventHash,
      actorId: actor.actorId,
      actorRole: actor.actorRole,
      digitalSignature,
      timestamp: new Date(timestampISO),
    })
    .returning();

  if (args.updateStatus !== false && args.toState) {
    await db
      .update(medicineBatches)
      .set({ currentStatus: args.toState, updatedAt: new Date() })
      .where(eq(medicineBatches.id, args.batchDbId));
  }

  return row;
}

// ── Verification ────────────────────────────────────────────────
export type AnnotatedEvent = typeof auditEvents.$inferSelect & {
  actorName: string | null;
  hashValid: boolean;
  signatureValid: boolean;
};

async function actorMaps() {
  const rows = await db.select().from(actors);
  return {
    pubById: new Map(rows.map((a) => [a.actorId, a.publicKey])),
    nameById: new Map(rows.map((a) => [a.actorId, a.name])),
  };
}

function annotateList(
  rowsAsc: (typeof auditEvents.$inferSelect)[],
  maps: { pubById: Map<string, string | null>; nameById: Map<string, string> }
): AnnotatedEvent[] {
  let expectedPrev = GENESIS_HASH;
  return rowsAsc.map((r) => {
    const tsISO = new Date(r.timestamp).toISOString();
    const recomputed = computeEventHash({
      batchId: r.batchId,
      eventType: r.eventType,
      eventData: (r.eventData ?? {}) as Record<string, unknown>,
      actorId: r.actorId,
      timestampISO: tsISO,
      previousHash: r.previousHash,
    });
    const hashValid = recomputed === r.eventHash && r.previousHash === expectedPrev;
    expectedPrev = r.eventHash;
    const pub = maps.pubById.get(r.actorId);
    const signatureValid = pub
      ? verifyHashSignature(pub, r.eventHash, r.digitalSignature)
      : false;
    return {
      ...r,
      actorName: maps.nameById.get(r.actorId) ?? null,
      hashValid,
      signatureValid,
    };
  });
}

/** Full annotated history of one batch, chronological order. */
export async function annotateBatchEvents(batchNumber: string): Promise<AnnotatedEvent[]> {
  const rows = await db
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.batchId, batchNumber))
    .orderBy(asc(auditEvents.id));
  return annotateList(rows, await actorMaps());
}

/** Latest annotated events across all batches, newest first. */
export async function annotateLatestEvents(limit = 200): Promise<AnnotatedEvent[]> {
  const rows = await db
    .select()
    .from(auditEvents)
    .orderBy(asc(auditEvents.id))
    .limit(5000);
  const maps = await actorMaps();
  const byBatch = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byBatch.get(r.batchId) ?? [];
    list.push(r);
    byBatch.set(r.batchId, list);
  }
  const annotated: AnnotatedEvent[] = [];
  for (const list of byBatch.values()) annotated.push(...annotateList(list, maps));
  annotated.sort((a, b) => b.id - a.id);
  return annotated.slice(0, limit);
}

export type IntegrityResult =
  | { valid: true; eventsVerified: number; signaturesVerified: number }
  | {
      valid: false;
      invalidRecordId: number;
      reason: "HASH_MISMATCH" | "PREV_LINK_BROKEN" | "SIGNATURE_INVALID";
      eventsChecked: number;
    };

/** Recompute every hash, check every link, verify every signature. */
export async function verifyBatchIntegrity(batchNumber: string): Promise<IntegrityResult> {
  const annotated = await annotateBatchEvents(batchNumber);
  let sigs = 0;
  for (const e of annotated) {
    if (!e.hashValid) {
      const tsISO = new Date(e.timestamp).toISOString();
      const recomputed = computeEventHash({
        batchId: e.batchId,
        eventType: e.eventType,
        eventData: (e.eventData ?? {}) as Record<string, unknown>,
        actorId: e.actorId,
        timestampISO: tsISO,
        previousHash: e.previousHash,
      });
      return {
        valid: false,
        invalidRecordId: e.id,
        reason: recomputed === e.eventHash ? "PREV_LINK_BROKEN" : "HASH_MISMATCH",
        eventsChecked: annotated.length,
      };
    }
    if (!e.signatureValid) {
      return {
        valid: false,
        invalidRecordId: e.id,
        reason: "SIGNATURE_INVALID",
        eventsChecked: annotated.length,
      };
    }
    sigs++;
  }
  return { valid: true, eventsVerified: annotated.length, signaturesVerified: sigs };
}

export async function verifyFullLedger(): Promise<{
  valid: boolean;
  events: number;
  batches: number;
  invalidBatch?: string;
  invalidRecordId?: number;
}> {
  const res = (await db.execute(
    sql`SELECT DISTINCT batch_id FROM audit_events`
  )) as unknown as { rows: { batch_id: string }[] };
  const batchIds = (res.rows ?? []).map((r) => r.batch_id);
  let events = 0;
  for (const batchId of batchIds) {
    const v = await verifyBatchIntegrity(batchId);
    if (!v.valid) {
      return {
        valid: false,
        events,
        batches: batchIds.length,
        invalidBatch: batchId,
        invalidRecordId: v.invalidRecordId,
      };
    }
    events += v.eventsVerified;
  }
  return { valid: true, events, batches: batchIds.length };
}
