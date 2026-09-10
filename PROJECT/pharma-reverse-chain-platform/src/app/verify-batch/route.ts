import { db } from "@/db";
import { actors, medicineBatches } from "@/db/schema";
import { eq } from "drizzle-orm";
import { appendAuditEvent } from "@/lib/audit";
import { NON_SELLABLE, recordFraudAlert } from "@/lib/pharma";
import { err, json, readBody, str } from "@/lib/api-helpers";

/**
 * POST /verify-batch — POS sale verification
 * Input: { batch_id | batch_number, pharmacy_id | pharmacy_name }
 * Every blocked attempt appends a signed SALE_BLOCKED audit event
 * and raises a regulator fraud alert.
 */
export async function POST(req: Request) {
  const body = await readBody(req as unknown as Parameters<typeof readBody>[0]);
  const batchNumber = str(body.batch_id, str(body.batch_number, str(body.batchNumber, ""))).trim();
  let pharmacyName = str(body.pharmacy_name, str(body.pharmacyName, "")).trim();
  const pharmacyId = str(body.pharmacy_id, str(body.pharmacyId, "")).trim();

  if (pharmacyId && !pharmacyName) {
    const a = await db.select().from(actors).where(eq(actors.actorId, pharmacyId)).limit(1);
    if (a.length > 0) pharmacyName = a[0].name;
  }
  if (!pharmacyName) pharmacyName = "Unknown Pharmacy";

  if (!batchNumber) return err("batch_id is required", 400);

  const rows = await db
    .select()
    .from(medicineBatches)
    .where(eq(medicineBatches.batchNumber, batchNumber));

  if (rows.length === 0) {
    return json({
      allowed: false,
      reason: "BATCH_NOT_FOUND",
      message: "Batch not found in the system",
      batch_id: batchNumber,
    });
  }

  const batch = rows[0];
  const status = batch.currentStatus ?? "";

  if (status === "ACTIVE") {
    return json({
      allowed: true,
      batch_id: batchNumber,
      medicine_name: batch.medicineName,
      status,
      message: "SALE ALLOWED — batch is ACTIVE",
    });
  }

  if ((NON_SELLABLE as string[]).includes(status)) {
    // Blocked sale attempt → fraud alert + signed SALE_BLOCKED audit event
    const alert = await recordFraudAlert({
      batchNumber,
      pharmacyName,
      batchStatus: status,
    });
    await appendAuditEvent({
      batchDbId: batch.id,
      batchNumber,
      eventType: "SALE_BLOCKED",
      fromState: status,
      toState: status,
      actorName: pharmacyName,
      actorRole: "Pharmacy",
      remarks: `POS sale blocked at ${pharmacyName} — batch is ${status}`,
      extra: {
        pharmacy_name: pharmacyName,
        batch_status: status,
        alert_id: alert.alertId,
        reason: "BATCH_NOT_ELIGIBLE_FOR_SALE",
      },
      updateStatus: false,
    });
    return json({
      allowed: false,
      reason: "BATCH_NOT_ELIGIBLE_FOR_SALE",
      message: "Batch not eligible for sale",
      batch_id: batchNumber,
      medicine_name: batch.medicineName,
      status,
      alert_id: alert.alertId,
    });
  }

  return json({
    allowed: false,
    reason: "BATCH_NOT_ELIGIBLE_FOR_SALE",
    message: "Batch not eligible for sale",
    status,
  });
}
