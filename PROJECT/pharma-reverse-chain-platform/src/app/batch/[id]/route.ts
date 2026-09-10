import { db } from "@/db";
import { medicineBatches } from "@/db/schema";
import { eq } from "drizzle-orm";
import { annotateBatchEvents, verifyBatchIntegrity } from "@/lib/audit";
import { err, json } from "@/lib/api-helpers";

/** GET /batch/{id} — batch detail + annotated audit history + integrity */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: idParam } = await ctx.params;
  const id = Number(idParam);
  if (!Number.isInteger(id)) return err("Invalid batch id", 400);
  const rows = await db.select().from(medicineBatches).where(eq(medicineBatches.id, id));
  if (rows.length === 0) return err("Batch not found", 404);
  const batch = rows[0];
  const history = await annotateBatchEvents(batch.batchNumber);
  const v = await verifyBatchIntegrity(batch.batchNumber);
  const integrity = v.valid
    ? { valid: true, events: v.eventsVerified, signatures: v.signaturesVerified }
    : { valid: false, invalid_record_id: v.invalidRecordId, reason: v.reason };
  return json({ batch, history, integrity });
}
