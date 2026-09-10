import { NextResponse } from "next/server";
import { db } from "@/db";
import { actors, auditEvents, fraudAlerts, medicineBatches } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { appendAuditEvent } from "@/lib/audit";
import { actorKeypair } from "@/lib/keystore";
import { EVENT_FOR_STATE, sha256 } from "@/lib/pharma";
import { SEED_ACTORS, SEED_BATCHES, actorForState, pathTo } from "@/lib/seed-data";

export const dynamic = "force-dynamic";

/** POST /api/seed — reset + load sample data (idempotent) */
export async function POST() {
  // Wipe in dependency-safe order (truncate is a DB reset, not an audit edit)
  await db.execute(sql`TRUNCATE TABLE fraud_alerts, audit_events, medicine_batches, actors RESTART IDENTITY CASCADE`);

  // Actors with public verification keys (private keys stay in the key store)
  for (const a of SEED_ACTORS) {
    const { publicKeyPem } = actorKeypair(a.actorId);
    await db.insert(actors).values({ ...a, publicKey: publicKeyPem });
  }

  // Batches + signed audit history
  for (const b of SEED_BATCHES) {
    const [batch] = await db
      .insert(medicineBatches)
      .values({
        batchNumber: b.batchNumber,
        medicineName: b.medicineName,
        manufacturerName: b.manufacturerName,
        expiryDate: b.expiryDate,
        quantity: b.quantity,
        currentStatus: "ACTIVE",
      })
      .returning();

    await appendAuditEvent({
      batchDbId: batch.id,
      batchNumber: batch.batchNumber,
      eventType: "BATCH_CREATED",
      fromState: "GENESIS",
      toState: "ACTIVE",
      actorName: b.manufacturerName,
      actorRole: "Manufacturer",
      remarks: `Batch ${b.batchNumber} manufactured and released`,
      extra: { medicine_name: b.medicineName, quantity: b.quantity },
      updateStatus: false,
    });

    let current = "ACTIVE";
    for (const next of pathTo(b.targetStatus)) {
      const actor = actorForState(next);
      const extra: Record<string, unknown> = {};
      let eventType = EVENT_FOR_STATE[next] ?? next;
      if (next === "DISPUTED") {
        eventType = "QUANTITY_DISCREPANCY";
        extra.expected_quantity = b.quantity;
        extra.received_quantity = b.quantity - 150;
        extra.difference = 150;
      }
      if (next === "DESTROYED") {
        extra.certificate_hash = sha256(`destruction-certificate-${b.batchNumber}`);
        extra.certificate_filename = `destruction-cert-${b.batchNumber}.pdf`;
        extra.status = "DESTROYED";
      }
      await appendAuditEvent({
        batchDbId: batch.id,
        batchNumber: batch.batchNumber,
        eventType,
        fromState: current,
        toState: next,
        actorName: actor.name,
        actorRole: actor.role,
        remarks: actor.remarks,
        extra,
      });
      current = next;
    }

    if (b.targetStatus === "DISPUTED") {
      await db
        .update(medicineBatches)
        .set({ discrepancyReason: "Quantity mismatch: counted 2,850 vs declared 3,000" })
        .where(eq(medicineBatches.id, batch.id));
    }
    if (b.targetStatus === "DESTROYED") {
      await db
        .update(medicineBatches)
        .set({
          certificateHash: sha256(`destruction-certificate-${b.batchNumber}`),
          certificateFilename: `destruction-cert-${b.batchNumber}.pdf`,
        })
        .where(eq(medicineBatches.id, batch.id));
    }
  }

  // One starter fraud alert + its signed SALE_BLOCKED event
  const target = await db
    .select()
    .from(medicineBatches)
    .where(eq(medicineBatches.batchNumber, "NV-CET-1008"))
    .limit(1);
  if (target.length > 0) {
    const [alert] = await db
      .insert(fraudAlerts)
      .values({
        batchNumber: "NV-CET-1008",
        pharmacyName: "GreenCross Pharmacy",
        batchStatus: "DESTROYED",
      })
      .returning();
    await appendAuditEvent({
      batchDbId: target[0].id,
      batchNumber: "NV-CET-1008",
      eventType: "SALE_BLOCKED",
      fromState: "DESTROYED",
      toState: "DESTROYED",
      actorName: "GreenCross Pharmacy",
      actorRole: "Pharmacy",
      remarks: "POS sale blocked at GreenCross Pharmacy — batch is DESTROYED",
      extra: {
        pharmacy_name: "GreenCross Pharmacy",
        batch_status: "DESTROYED",
        alert_id: alert.alertId,
        reason: "BATCH_NOT_ELIGIBLE_FOR_SALE",
      },
      updateStatus: false,
    });
  }

  const counts = {
    actors: (await db.select().from(actors)).length,
    batches: (await db.select().from(medicineBatches)).length,
    auditEvents: (await db.select().from(auditEvents)).length,
    alerts: (await db.select().from(fraudAlerts)).length,
  };
  return NextResponse.json({ seeded: true, counts });
}

export async function GET() {
  return POST();
}
