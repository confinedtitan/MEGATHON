import { NextRequest } from "next/server";
import { doTransition } from "@/lib/api-helpers";

/** POST /batch/{id}/destruction-ready — RECEIVED_BY_DISTRIBUTOR → WAITING_FOR_DESTRUCTION */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return doTransition(req, id, "WAITING_FOR_DESTRUCTION", "Manufacturer");
}
