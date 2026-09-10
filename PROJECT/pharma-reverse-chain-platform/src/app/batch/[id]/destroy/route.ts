import { NextRequest } from "next/server";
import { db } from "@/db";
import { medicineBatches } from "@/db/schema";
import { eq } from "drizzle-orm";
import { appendAuditEvent } from "@/lib/audit";
import { isTransitionAllowed } from "@/lib/pharma";
import { err, json, readBody, str } from "@/lib/api-helpers";

/** POST /batch/{id}/destroy — WAITING_FOR_DESTRUCTION → DESTROYED.
 *  The destruction-certificate SHA-256 is embedded in the signed
 *  DESTRUCTION_VERIFIED event data. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await ctx.params;
  const id = Number(idParam);
  if (!Number.isInteger(id)) return err("Invalid batch id", 400);
  const rows = await db.select().from(medicineBatches).where(eq(medicineBatches.id, id));
  if (rows.length === 0) return err("Batch not found", 404);
  const batch = rows[0];
  const body = await readBody(req);
  const actorName = str(body.actor_name, str(body.actorName, "NovaGen Labs"));
  const actorRole = str(body.actor_role, str(body.actorRole, "Manufacturer"));
  const remarks = str(body.remarks, "Destroyed under supervision. Certificate issued.");

  const check = isTransitionAllowed(batch.currentStatus ?? "", "DESTROYED");
  if (!check.ok) {
    return err(check.reason ?? "Invalid transition", 422, {
      from: batch.currentStatus,
      to: "DESTROYED",
    });
  }
  const auditEvent = await appendAuditEvent({
    batchDbId: id,
    batchNumber: batch.batchNumber,
    eventType: "DESTRUCTION_VERIFIED",
    fromState: batch.currentStatus ?? "",
    toState: "DESTROYED",
    actorName,
    actorRole,
    remarks,
    extra: {
      status: "DESTROYED",
      ...(batch.certificateHash ? { certificate_hash: batch.certificateHash } : {}),
      ...(batch.certificateFilename ? { certificate_filename: batch.certificateFilename } : {}),
    },
  });
  const updated = await db.select().from(medicineBatches).where(eq(medicineBatches.id, id));
  return json({ batch: updated[0], audit_event: auditEvent });
}
