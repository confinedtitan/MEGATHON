import { db } from "@/db";
import { medicineBatches } from "@/db/schema";
import { appendAuditEvent } from "@/lib/audit";
import { err, json, readBody, str } from "@/lib/api-helpers";

/** POST /batch — create a new ACTIVE medicine batch (+ signed BATCH_CREATED event) */
export async function POST(req: Request) {
  const body = await readBody(req as unknown as Parameters<typeof readBody>[0]);
  const batchNumber = str(body.batch_number, str(body.batchNumber, "")).trim();
  const medicineName = str(body.medicine_name, str(body.medicineName, "")).trim();
  const manufacturerName = str(body.manufacturer_name, str(body.manufacturerName, "NovaGen Labs")).trim();
  const expiryDate = str(body.expiry_date, str(body.expiryDate, "")).trim();
  const quantity = Number(body.quantity ?? 0);
  const actorName = str(body.actor_name, str(body.actorName, "NovaGen Labs"));
  const actorRole = str(body.actor_role, str(body.actorRole, "Manufacturer"));

  if (!batchNumber || !medicineName || !expiryDate) {
    return err("batch_number, medicine_name and expiry_date are required", 400);
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return err("quantity must be a positive integer", 400);
  }

  try {
    const [batch] = await db
      .insert(medicineBatches)
      .values({
        batchNumber,
        medicineName,
        manufacturerName,
        expiryDate,
        quantity,
        currentStatus: "ACTIVE",
      })
      .returning();

    const auditEvent = await appendAuditEvent({
      batchDbId: batch.id,
      batchNumber: batch.batchNumber,
      eventType: "BATCH_CREATED",
      fromState: "GENESIS",
      toState: "ACTIVE",
      actorName,
      actorRole,
      remarks: "Batch created and released as ACTIVE",
      extra: { medicine_name: medicineName, quantity },
      updateStatus: false,
    });

    return json({ batch, audit_event: auditEvent }, 201);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Create failed";
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return err(`Batch number ${batchNumber} already exists`, 409);
    }
    return err(msg, 500);
  }
}
