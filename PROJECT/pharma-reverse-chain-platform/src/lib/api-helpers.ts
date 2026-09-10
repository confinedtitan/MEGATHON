import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { medicineBatches } from "@/db/schema";
import { eq } from "drizzle-orm";
import { appendAuditEvent } from "@/lib/audit";
import { EVENT_FOR_STATE, isTransitionAllowed } from "@/lib/pharma";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function err(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export async function readBody(req: NextRequest): Promise<Record<string, unknown>> {
  try {
    const t = await req.text();
    if (!t) return {};
    return JSON.parse(t) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function str(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.length > 0 ? v : fallback;
}

/** Generic guarded transition: state machine + signed audit event. */
export async function doTransition(
  req: NextRequest,
  idParam: string,
  toState: string,
  defaultActorRole: string,
  opts?: { eventType?: string; extra?: Record<string, unknown> }
) {
  const id = Number(idParam);
  if (!Number.isInteger(id)) return err("Invalid batch id", 400);
  const rows = await db.select().from(medicineBatches).where(eq(medicineBatches.id, id));
  if (rows.length === 0) return err("Batch not found", 404);
  const batch = rows[0];

  const body = await readBody(req);
  const actorName = str(body.actor_name, str(body.actorName, "Unknown"));
  const actorRole = str(body.actor_role, str(body.actorRole, defaultActorRole));
  const remarks = str(body.remarks, str(body.reason, ""));

  const check = isTransitionAllowed(batch.currentStatus ?? "", toState);
  if (!check.ok) {
    return err(check.reason ?? "Invalid transition", 422, {
      from: batch.currentStatus,
      to: toState,
    });
  }

  try {
    const auditEvent = await appendAuditEvent({
      batchDbId: batch.id,
      batchNumber: batch.batchNumber,
      eventType: opts?.eventType ?? EVENT_FOR_STATE[toState] ?? toState,
      fromState: batch.currentStatus ?? "",
      toState,
      actorName,
      actorRole,
      remarks: remarks || null,
      extra: opts?.extra,
    });
    const updated = await db
      .select()
      .from(medicineBatches)
      .where(eq(medicineBatches.id, id));
    return json({ batch: updated[0], audit_event: auditEvent });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Transition failed";
    return err(msg, 422);
  }
}
