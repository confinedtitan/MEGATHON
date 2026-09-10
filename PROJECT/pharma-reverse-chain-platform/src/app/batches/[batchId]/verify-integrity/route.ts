import { db } from "@/db";
import { medicineBatches } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyBatchIntegrity } from "@/lib/audit";
import { err, json } from "@/lib/api-helpers";

/** GET /batches/{batch_id}/verify-integrity
 *  Recalculates every event hash, checks every previous_hash link and
 *  verifies every Ed25519 signature for the batch. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await ctx.params;
  const batchNumber = decodeURIComponent(batchId);
  const rows = await db
    .select()
    .from(medicineBatches)
    .where(eq(medicineBatches.batchNumber, batchNumber))
    .limit(1);
  if (rows.length === 0) return err("Batch not found", 404);

  const v = await verifyBatchIntegrity(batchNumber);
  if (v.valid) {
    return json({
      batch_id: batchNumber,
      integrity_valid: true,
      events_verified: v.eventsVerified,
      signatures_verified: v.signaturesVerified,
    });
  }
  return json({
    batch_id: batchNumber,
    integrity_valid: false,
    error: "HASH_CHAIN_TAMPER_DETECTED",
    invalid_record_id: v.invalidRecordId,
    detail: v.reason,
  });
}
