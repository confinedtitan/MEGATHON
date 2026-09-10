import { NextRequest } from "next/server";
import { db } from "@/db";
import { medicineBatches } from "@/db/schema";
import { eq } from "drizzle-orm";
import { appendAuditEvent } from "@/lib/audit";
import { isTransitionAllowed } from "@/lib/pharma";
import { err, json, readBody, str } from "@/lib/api-helpers";

/** POST /batch/{id}/resolve-dispute — DISPUTED → RECEIVED_BY_DISTRIBUTOR.
 *  History is never rewritten: a signed DISPUTE_RESOLVED reconciliation
 *  event is appended and the original discrepancy stays in the trail. */
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
  const resolution = str(body.resolution, str(body.remarks, "Dispute resolved — quantity reconciled"));

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
    eventType: "DISPUTE_RESOLVED",
    fromState: batch.currentStatus ?? "",
    toState: "RECEIVED_BY_DISTRIBUTOR",
    actorName,
    actorRole,
    remarks: resolution,
    extra: { reconciliation: resolution, prior_discrepancy: batch.discrepancyReason },
  });
  await db
    .update(medicineBatches)
    .set({ discrepancyReason: `Resolved: ${resolution}`, updatedAt: new Date() })
    .where(eq(medicineBatches.id, id));
  const updated = await db.select().from(medicineBatches).where(eq(medicineBatches.id, id));
  return json({ batch: updated[0], audit_event: auditEvent });
}
