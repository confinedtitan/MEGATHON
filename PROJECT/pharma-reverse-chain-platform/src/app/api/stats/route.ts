import { NextResponse } from "next/server";
import { db } from "@/db";
import { auditEvents, fraudAlerts, medicineBatches } from "@/db/schema";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const batches = await db.select().from(medicineBatches);
  const evts = await db.select({ c: sql<number>`count(*)` }).from(auditEvents);
  const alerts = await db.select().from(fraudAlerts);

  const byStatus: Record<string, number> = {};
  for (const b of batches) {
    const s = b.currentStatus ?? "UNKNOWN";
    byStatus[s] = (byStatus[s] ?? 0) + 1;
  }

  return NextResponse.json({
    totalBatches: batches.length,
    byStatus,
    totalAuditEvents: Number(evts[0]?.c ?? 0),
    totalAlerts: alerts.length,
    blockedBatches: batches.filter((b) => b.currentStatus !== "ACTIVE").length,
    sellableBatches: batches.filter((b) => b.currentStatus === "ACTIVE").length,
  });
}
