import { NextResponse } from "next/server";
import { db } from "@/db";
import { medicineBatches } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { verifyBatchIntegrity } from "@/lib/audit";

export const dynamic = "force-dynamic";

/** GET /api/integrity?status=&search= — per-batch integrity summaries */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  let batches =
    status && status.length > 0
      ? await db
          .select()
          .from(medicineBatches)
          .where(eq(medicineBatches.currentStatus, status))
          .orderBy(desc(medicineBatches.id))
      : await db.select().from(medicineBatches).orderBy(desc(medicineBatches.id));

  const search = (url.searchParams.get("search") ?? "").toLowerCase();
  if (search) {
    batches = batches.filter(
      (b) =>
        b.batchNumber.toLowerCase().includes(search) ||
        b.medicineName.toLowerCase().includes(search)
    );
  }

  const results = [];
  for (const b of batches) {
    const v = await verifyBatchIntegrity(b.batchNumber);
    results.push(
      v.valid
        ? {
            batch_number: b.batchNumber,
            medicine_name: b.medicineName,
            status: b.currentStatus,
            integrity_valid: true,
            events: v.eventsVerified,
            signatures: v.signaturesVerified,
          }
        : {
            batch_number: b.batchNumber,
            medicine_name: b.medicineName,
            status: b.currentStatus,
            integrity_valid: false,
            events: v.eventsChecked,
            signatures: 0,
            invalid_record_id: v.invalidRecordId,
            reason: v.reason,
          }
    );
  }

  return NextResponse.json({
    batches: results,
    summary: {
      total: results.length,
      valid: results.filter((r) => r.integrity_valid).length,
      invalid: results.filter((r) => !r.integrity_valid).length,
    },
  });
}
