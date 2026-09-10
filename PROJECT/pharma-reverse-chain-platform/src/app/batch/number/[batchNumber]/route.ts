import { db } from "@/db";
import { medicineBatches } from "@/db/schema";
import { eq } from "drizzle-orm";
import { annotateBatchEvents, verifyBatchIntegrity } from "@/lib/audit";
import { err, json } from "@/lib/api-helpers";

/** GET /batch/number/{batchNumber} — batch + annotated audit history + integrity */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ batchNumber: string }> }
) {
  const { batchNumber: raw } = await ctx.params;
  const batchNumber = decodeURIComponent(raw);
  const rows = await db
    .select()
    .from(medicineBatches)
    .where(eq(medicineBatches.batchNumber, batchNumber))
    .limit(1);
  if (rows.length === 0) return err("Batch not found", 404);
  const history = await annotateBatchEvents(batchNumber);
  const v = await verifyBatchIntegrity(batchNumber);
  const integrity = v.valid
    ? { valid: true, events: v.eventsVerified, signatures: v.signaturesVerified }
    : { valid: false, invalid_record_id: v.invalidRecordId, reason: v.reason };
  return json({ batch: rows[0], history, integrity });
}
