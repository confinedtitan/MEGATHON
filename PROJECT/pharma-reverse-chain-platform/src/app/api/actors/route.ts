import { NextResponse } from "next/server";
import { db } from "@/db";
import { actors } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.select().from(actors);
  return NextResponse.json({ actors: rows });
}
