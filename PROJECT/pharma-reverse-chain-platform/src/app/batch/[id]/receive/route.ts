import { NextRequest } from "next/server";
import { db } from "@/db";
import { medicineBatches } from "@/db/schema";
import { eq } from "drizzle-orm";
import { appendAuditEvent } from "@/lib/audit";
import { isTransitionAllowed } from "@/lib/pharma";
import { err, json, readBody, str } from "@/lib/api-helpers";

/**
 * POST /batch/{id}/receive — PICKUP_SCHEDULED → RECEIVED_BY_DISTRIBUTOR
 * Quantity verification: body may include `received_quantity`.
 * If it differs from the declared quantity the batch moves to DISPUTED
 * with a signed QUANTITY_DISCREPANCY event.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await ctx.params;
  const id = Number(idParam);
  if (!Number.isInteger(id)) return err("Invalid batch id", 400);
  const rows = await db.select().from(medicineBatches).where(eq(medicineBatches.id, id));
  if (rows.length === 0) return err("Batch not found", 404);
  const batch = rows[0];

  const body = await readBody(req);
  const actorName = str(body.actor_name, str(body.actorName, "MediTrans Logistics"));
  const actorRole = str(body.actor_role, str(body.actorRole, "Distributor"));
  const remarks = str(body.remarks, "");
  const receivedRaw = body.received_quantity ?? body.receivedQuantity;

  // Quantity check → dispute path
  if (receivedRaw !== undefined && receivedRaw !== null && receivedRaw !== "") {
    const received = Number(receivedRaw);
    if (!Number.isInteger(received) || received < 0) {
      return err("received_quantity must be a non-negative integer", 400);
    }
    if (received !== batch.quantity) {
      const check = isTransitionAllowed(batch.currentStatus ?? "", "DISPUTED");
      if (!check.ok) return err(check.reason ?? "Cannot dispute from this state", 422);
      const reason =
        str(body.reason, "") ||
        remarks ||
        `Quantity mismatch: counted ${received} vs declared ${batch.quantity}`;
      await db
        .update(medicineBatches)
        .set({ discrepancyReason: reason, updatedAt: new Date() })
        .where(eq(medicineBatches.id, id));
      const auditEvent = await appendAuditEvent({
        batchDbId: id,
        batchNumber: batch.batchNumber,
        eventType: "QUANTITY_DISCREPANCY",
        fromState: batch.currentStatus ?? "",
        toState: "DISPUTED",
        actorName,
        actorRole,
        remarks: reason,
        extra: {
          expected_quantity: batch.quantity,
          received_quantity: received,
          difference: Math.abs(batch.quantity - received),
        },
      });
      const updated = await db.select().from(medicineBatches).where(eq(medicineBatches.id, id));
      return json({ batch: updated[0], audit_event: auditEvent, disputed: true }, 201);
    }
  }

  const check = isTransitionAllowed(batch.currentStatus ?? "", "RECEIVED_BY_DISTRIBUTOR");
  if (!check.ok) {
    return err(check.reason ?? "Invalid transition", 422, {
      from: batch.currentStatus,
      to: "RECEIVED_BY_DISTRIBUTOR",
    });
  }
  const auditEvent = await appendAuditEvent({
    batchDbId: id,
    batchNumber: batch.batchNumber,
    eventType: "RECEIVED_BY_DISTRIBUTOR",
    fromState: batch.currentStatus ?? "",
    toState: "RECEIVED_BY_DISTRIBUTOR",
    actorName,
    actorRole,
    remarks: remarks || `Received ${receivedRaw ?? batch.quantity} units — quantity verified OK`,
    extra: { received_quantity: receivedRaw !== undefined && receivedRaw !== "" ? Number(receivedRaw) : batch.quantity },
  });
  const updated = await db.select().from(medicineBatches).where(eq(medicineBatches.id, id));
  return json({ batch: updated[0], audit_event: auditEvent, disputed: false }, 201);
}
