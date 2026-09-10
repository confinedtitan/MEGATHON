import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { auditEvents, medicineBatches } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";

/**
 * POST /api/demo/tamper — DEMO ATTACK SIMULATOR (not a user API).
 * Simulates an attacker with direct database access modifying one audit
 * record out-of-band, bypassing the application (the application itself
 * exposes NO update/delete endpoint for audit records). Afterwards,
 * integrity verification must report HASH_CHAIN_TAMPER_DETECTED.
 * Restore with POST /api/seed.
 */
export async function POST(req: NextRequest) {
  let batchNumber = "";
  try {
    const body = (await req.json()) as { batch_number?: string; batchNumber?: string };
    batchNumber = (body.batch_number ?? body.batchNumber ?? "").trim();
  } catch {
    /* ignore */
  }
  if (!batchNumber) {
    return NextResponse.json({ error: "batch_number is required" }, { status: 400 });
  }
  const batches = await db
    .select()
    .from(medicineBatches)
    .where(eq(medicineBatches.batchNumber, batchNumber))
    .limit(1);
  if (batches.length === 0) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }
  const events = await db
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.batchId, batchNumber))
    .orderBy(asc(auditEvents.id));
  if (events.length < 2) {
    return NextResponse.json(
      { error: "Batch needs at least 2 audit events for the tamper demo" },
      { status: 400 }
    );
  }
  const target = events[Math.floor(events.length / 2)];
  // Direct SQL modification — exactly what normal application users cannot do.
  await db.execute(
    sql`UPDATE audit_events SET event_data = jsonb_set(event_data, '{tampered}', '"true"', true) WHERE id = ${target.id}`
  );
  return NextResponse.json({
    tampered: true,
    batch_number: batchNumber,
    tampered_record_id: target.id,
    event_type: target.eventType,
    note: "Audit record modified directly in the database. Run integrity verification to detect it.",
  });
}
