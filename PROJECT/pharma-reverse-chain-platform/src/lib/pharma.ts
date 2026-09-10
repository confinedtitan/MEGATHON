import { createHash } from "crypto";
import { db } from "@/db";
import { fraudAlerts } from "@/db/schema";

// ── Lifecycle states ────────────────────────────────────────────
export const STATUSES = [
  "ACTIVE",
  "LOGGED_FOR_RETURN",
  "PICKUP_SCHEDULED",
  "RECEIVED_BY_DISTRIBUTOR",
  "DISPUTED",
  "WAITING_FOR_DESTRUCTION",
  "DESTROYED",
] as const;

export type BatchStatus = (typeof STATUSES)[number];

export const NON_SELLABLE: BatchStatus[] = [
  "LOGGED_FOR_RETURN",
  "PICKUP_SCHEDULED",
  "RECEIVED_BY_DISTRIBUTOR",
  "DISPUTED",
  "WAITING_FOR_DESTRUCTION",
  "DESTROYED",
];

// ── Allowed transitions (backend state machine) ─────────────────
// ACTIVE → LOGGED_FOR_RETURN
// LOGGED_FOR_RETURN → PICKUP_SCHEDULED
// PICKUP_SCHEDULED → RECEIVED_BY_DISTRIBUTOR
// RECEIVED_BY_DISTRIBUTOR → WAITING_FOR_DESTRUCTION
// WAITING_FOR_DESTRUCTION → DESTROYED
// DISPUTED → RECEIVED_BY_DISTRIBUTOR
// Forbidden: DESTROYED → anything, anything → ACTIVE, etc.
// Quantity mismatches move a batch into DISPUTED from PICKUP_SCHEDULED
// or RECEIVED_BY_DISTRIBUTOR (distributor check).
export const ALLOWED_TRANSITIONS: Record<BatchStatus, BatchStatus[]> = {
  ACTIVE: ["LOGGED_FOR_RETURN"],
  LOGGED_FOR_RETURN: ["PICKUP_SCHEDULED"],
  PICKUP_SCHEDULED: ["RECEIVED_BY_DISTRIBUTOR", "DISPUTED"],
  RECEIVED_BY_DISTRIBUTOR: ["WAITING_FOR_DESTRUCTION", "DISPUTED"],
  DISPUTED: ["RECEIVED_BY_DISTRIBUTOR"],
  WAITING_FOR_DESTRUCTION: ["DESTROYED"],
  DESTROYED: [],
};

export function isTransitionAllowed(
  from: string,
  to: string
): { ok: boolean; reason?: string } {
  const f = from as BatchStatus;
  const t = to as BatchStatus;
  if (!STATUSES.includes(f)) return { ok: false, reason: `Unknown state: ${from}` };
  if (!STATUSES.includes(t)) return { ok: false, reason: `Unknown state: ${to}` };
  if (f === "DESTROYED") {
    return { ok: false, reason: "DESTROYED is terminal — no further transitions allowed" };
  }
  const allowed = ALLOWED_TRANSITIONS[f] ?? [];
  if (!allowed.includes(t)) {
    return { ok: false, reason: `Transition ${from} → ${to} is forbidden` };
  }
  return { ok: true };
}

// Default audit event type recorded for each target state.
export const EVENT_FOR_STATE: Record<string, string> = {
  ACTIVE: "BATCH_CREATED",
  LOGGED_FOR_RETURN: "LOGGED_FOR_RETURN",
  PICKUP_SCHEDULED: "PICKUP_SCHEDULED",
  RECEIVED_BY_DISTRIBUTOR: "RECEIVED_BY_DISTRIBUTOR",
  DISPUTED: "DISPUTE_RAISED",
  WAITING_FOR_DESTRUCTION: "WAITING_FOR_DESTRUCTION",
  DESTROYED: "DESTRUCTION_VERIFIED",
};

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export async function recordFraudAlert(args: {
  batchNumber: string;
  pharmacyName: string;
  batchStatus: string;
}) {
  const [row] = await db
    .insert(fraudAlerts)
    .values({
      batchNumber: args.batchNumber,
      pharmacyName: args.pharmacyName,
      batchStatus: args.batchStatus,
    })
    .returning();
  return row;
}

export const STATUS_META: Record<string, { label: string; hint: string }> = {
  ACTIVE: { label: "Active", hint: "Sellable" },
  LOGGED_FOR_RETURN: { label: "Logged for Return", hint: "Blocked from sale" },
  PICKUP_SCHEDULED: { label: "Pickup Scheduled", hint: "Blocked from sale" },
  RECEIVED_BY_DISTRIBUTOR: { label: "Received by Distributor", hint: "Blocked from sale" },
  DISPUTED: { label: "Disputed", hint: "Blocked — needs resolution" },
  WAITING_FOR_DESTRUCTION: { label: "Waiting for Destruction", hint: "Blocked from sale" },
  DESTROYED: { label: "Destroyed", hint: "Terminal — never sellable" },
};
