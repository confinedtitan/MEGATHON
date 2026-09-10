const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-800 ring-emerald-600/20",
  LOGGED_FOR_RETURN: "bg-orange-100 text-orange-800 ring-orange-600/20",
  PICKUP_SCHEDULED: "bg-sky-100 text-sky-800 ring-sky-600/20",
  RECEIVED_BY_DISTRIBUTOR: "bg-violet-100 text-violet-800 ring-violet-600/20",
  DISPUTED: "bg-red-100 text-red-800 ring-red-600/20",
  WAITING_FOR_DESTRUCTION: "bg-amber-100 text-amber-900 ring-amber-600/20",
  DESTROYED: "bg-neutral-800 text-neutral-100 ring-neutral-900",
};

export function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? "bg-slate-100 text-slate-700 ring-slate-500/20";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${cls}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

const EVENT_STYLES: Record<string, string> = {
  BATCH_CREATED: "bg-emerald-100 text-emerald-800 ring-emerald-600/20",
  LOGGED_FOR_RETURN: "bg-orange-100 text-orange-800 ring-orange-600/20",
  PICKUP_SCHEDULED: "bg-sky-100 text-sky-800 ring-sky-600/20",
  RECEIVED_BY_DISTRIBUTOR: "bg-violet-100 text-violet-800 ring-violet-600/20",
  QUANTITY_DISCREPANCY: "bg-red-100 text-red-800 ring-red-600/20",
  DISPUTE_RAISED: "bg-red-100 text-red-800 ring-red-600/20",
  DISPUTE_RESOLVED: "bg-teal-100 text-teal-800 ring-teal-600/20",
  WAITING_FOR_DESTRUCTION: "bg-amber-100 text-amber-900 ring-amber-600/20",
  DESTRUCTION_VERIFIED: "bg-neutral-800 text-neutral-100 ring-neutral-900",
  SALE_BLOCKED: "bg-red-700 text-white ring-red-900",
};

export function EventBadge({ eventType }: { eventType: string }) {
  const cls = EVENT_STYLES[eventType] ?? "bg-slate-100 text-slate-700 ring-slate-500/20";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${cls}`}>
      {eventType}
    </span>
  );
}

export function IntegrityPill({ valid }: { valid: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${valid ? "bg-emerald-100 text-emerald-800 ring-emerald-600/20" : "bg-red-100 text-red-800 ring-red-600/30"}`}>
      {valid ? "✓ VERIFIED" : "⚠ INTEGRITY FAILURE"}
    </span>
  );
}
