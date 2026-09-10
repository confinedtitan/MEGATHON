import { NextRequest } from "next/server";
import { doTransition } from "@/lib/api-helpers";

/** POST /batch/{id}/return — ACTIVE → LOGGED_FOR_RETURN */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return doTransition(req, id, "LOGGED_FOR_RETURN", "Pharmacy");
}
