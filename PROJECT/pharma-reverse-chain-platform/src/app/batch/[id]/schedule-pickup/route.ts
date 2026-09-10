import { NextRequest } from "next/server";
import { doTransition } from "@/lib/api-helpers";

/** POST /batch/{id}/schedule-pickup — LOGGED_FOR_RETURN → PICKUP_SCHEDULED */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return doTransition(req, id, "PICKUP_SCHEDULED", "Distributor");
}
