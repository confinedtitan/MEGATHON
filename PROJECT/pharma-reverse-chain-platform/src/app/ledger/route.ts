import { db } from "@/db";
import { medicineBatches } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  annotateBatchEvents,
  annotateLatestEvents,
  verifyBatchIntegrity,
  verifyFullLedger,
} from "@/lib/audit";
import { json } from "@/lib/api-helpers";

/** GET /ledger?batch_id=NV-... — signed audit events + integrity report.
 *  The audit ledger is a SHA-256 hash chain with Ed25519 signatures,
 *  stored entirely in PostgreSQL. There is no blockchain. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const batchParam = url.searchParams.get("batch_id");

  if (batchParam) {
    // Accept a batch number (preferred) or a numeric batch id.
    let batchNumber = batchParam;
    const byNumber = await db
      .select()
      .from(medicineBatches)
      .where(eq(medicineBatches.batchNumber, batchParam))
      .limit(1);
    if (byNumber.length === 0 && /^\d+$/.test(batchParam)) {
      const byId = await db
        .select()
        .from(medicineBatches)
        .where(eq(medicineBatches.id, Number(batchParam)))
        .limit(1);
      if (byId.length > 0) batchNumber = byId[0].batchNumber;
    }
    const ascEvents = await annotateBatchEvents(batchNumber);
    const v = await verifyBatchIntegrity(batchNumber);
    const integrity = v.valid
      ? { valid: true, events: v.eventsVerified, signatures: v.signaturesVerified }
      : {
          valid: false,
          invalid_record_id: v.invalidRecordId,
          reason: v.reason,
          events: v.eventsChecked,
        };
    const audit_events = [...ascEvents].reverse();
    return json({ audit_events, count: audit_events.length, integrity });
  }

  const audit_events = await annotateLatestEvents(200);
  const full = await verifyFullLedger();
  const integrity = full.valid
    ? { valid: true, events: full.events, batches: full.batches }
    : {
        valid: false,
        events: full.events,
        batches: full.batches,
        invalid_batch: full.invalidBatch,
        invalid_record_id: full.invalidRecordId,
      };
  return json({ audit_events, count: audit_events.length, integrity });
}
