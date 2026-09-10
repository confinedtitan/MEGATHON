import { db } from "@/db";
import { fraudAlerts } from "@/db/schema";
import { desc } from "drizzle-orm";
import { json } from "@/lib/api-helpers";

/** GET /alerts — fraud alerts from blocked sale attempts */
export async function GET() {
  const rows = await db.select().from(fraudAlerts).orderBy(desc(fraudAlerts.alertId)).limit(200);
  return json({ alerts: rows, count: rows.length });
}
