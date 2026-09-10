import { db } from "@/db";
import { medicineBatches } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { json } from "@/lib/api-helpers";

/** GET /batches?status=ACTIVE&search=para */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  let rows;
  if (status) {
    rows = await db
      .select()
      .from(medicineBatches)
      .where(eq(medicineBatches.currentStatus, status))
      .orderBy(desc(medicineBatches.id));
  } else {
    rows = await db.select().from(medicineBatches).orderBy(desc(medicineBatches.id));
  }
  const search = (url.searchParams.get("search") ?? "").toLowerCase();
  if (search) {
    rows = rows.filter(
      (b) =>
        b.batchNumber.toLowerCase().includes(search) ||
        b.medicineName.toLowerCase().includes(search) ||
        b.manufacturerName.toLowerCase().includes(search)
    );
  }
  return json({ batches: rows, count: rows.length });
}
