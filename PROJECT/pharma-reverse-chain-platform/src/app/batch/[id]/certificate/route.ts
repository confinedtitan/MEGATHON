import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { db } from "@/db";
import { medicineBatches } from "@/db/schema";
import { eq } from "drizzle-orm";
import { err } from "@/lib/api-helpers";

/**
 * POST /batch/{id}/certificate — upload destruction certificate (PDF),
 * store locally, compute SHA256, persist certificate_hash.
 * multipart/form-data with field `file`.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await ctx.params;
  const id = Number(idParam);
  if (!Number.isInteger(id)) return err("Invalid batch id", 400);
  const rows = await db.select().from(medicineBatches).where(eq(medicineBatches.id, id));
  if (rows.length === 0) return err("Batch not found", 404);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return err("Expected multipart/form-data with a `file` field", 400);
  }
  const file = form.get("file");
  if (!file || typeof file === "string") return err("No file uploaded (field `file` required)", 400);

  const buf = Buffer.from(await (file as File).arrayBuffer());
  if (buf.length === 0) return err("Empty file", 400);
  if (buf.length > 10 * 1024 * 1024) return err("File too large (max 10 MB)", 413);

  const originalName = (file as File).name || "certificate.pdf";
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const hash = createHash("sha256").update(buf).digest("hex");

  const dir = path.join(process.cwd(), "storage", "certificates", String(id));
  await mkdir(dir, { recursive: true });
  const storedName = `${Date.now()}-${safeName}`;
  await writeFile(path.join(dir, storedName), buf);

  await db
    .update(medicineBatches)
    .set({
      certificateHash: hash,
      certificateFilename: storedName,
      updatedAt: new Date(),
    })
    .where(eq(medicineBatches.id, id));

  const updated = await db.select().from(medicineBatches).where(eq(medicineBatches.id, id));
  return NextResponse.json({
    batch: updated[0],
    certificate_hash: hash,
    certificate_filename: storedName,
    size_bytes: buf.length,
  });
}
