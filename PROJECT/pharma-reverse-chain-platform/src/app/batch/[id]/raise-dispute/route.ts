import { NextRequest } from "next/server";
import { db } from "@/db";
import { medicineBatches } from "@/db/schema";
import { eq } from "drizzle-orm";
import { appendAuditEvent } from "@/lib/audit";
import { isTransitionAllowed } from "@/lib/pharma";
import { err, json, readBody, str } from "@/lib/api-helpers";

/** POST /batch/{id}/raise-dispute — → DISPUTED with signed event */
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
  const reason = str(body.reason, str(body.remarks, "Dispute raised")) || "Dispute raised";

  const check = isTransitionAllowed(batch.currentStatus ?? "", "DISPUTED");
  if (!check.ok) {
    return err(check.reason ?? "Cannot dispute from this state", 422, {
      from: batch.currentStatus,
      to: "DISPUTED",
    });
  }
  await db
    .update(medicineBatches)
    .set({ discrepancyReason: reason, updatedAt: new Date() })
    .where(eq(medicineBatches.id, id));
  const auditEvent = await appendAuditEvent({
    batchDbId: id,
    batchNumber: batch.batchNumber,
    eventType: "DISPUTE_RAISED",
    fromState: batch.currentStatus ?? "",
    toState: "DISPUTED",
    actorName,
    actorRole,
    remarks: reason,
  });
  const updated = await db.select().from(medicineBatches).where(eq(medicineBatches.id, id));
  return json({ batch: updated[0], audit_event: auditEvent });
}
