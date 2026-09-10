"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useState } from "react";

export const STATUS_STYLES: Record<string, string> = {
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
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${cls}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

export const EVENT_STYLES: Record<string, string> = {
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

const NAV = [
  { href: "/", label: "Overview", icon: "◈", desc: "Command center" },
  { href: "/pharmacy", label: "Pharmacy", icon: "✚", desc: "POS & returns" },
  { href: "/distributor", label: "Distributor", icon: "▣", desc: "Pickup & receipt" },
  { href: "/manufacturer", label: "Manufacturer", icon: "⬢", desc: "Destruction" },
  { href: "/regulator", label: "Regulator", icon: "◎", desc: "Oversight & alerts" },
  { href: "/audit", label: "Audit Ledger", icon: "🔏", desc: "Hash chain & signatures" },
  { href: "/docs", label: "API Docs", icon: "❖", desc: "Endpoints & setup" },
];

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed left-4 top-4 z-50 rounded-xl bg-slate-900 p-2.5 text-white shadow-lg lg:hidden"
        aria-label="Toggle menu"
      >
        {open ? "✕" : "☰"}
      </button>
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-slate-950 text-white transition-transform lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="border-b border-white/10 p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-teal-400 to-emerald-600 text-xl font-bold">
              ℞
            </div>
            <div>
              <p className="text-sm font-bold leading-tight">Pharma Reverse Chain</p>
              <p className="text-[11px] text-slate-400">Compliance Platform</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-300 ring-1 ring-emerald-500/20">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            Hash-chained audit ledger · Ed25519 signed
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV.map((n) => {
            const active = pathname === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition ${
                  active
                    ? "bg-white text-slate-900 shadow"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span
                  className={`grid h-8 w-8 place-items-center rounded-lg text-sm font-bold ${
                    active ? "bg-slate-900 text-white" : "bg-white/10"
                  }`}
                >
                  {n.icon}
                </span>
                <span>
                  <span className="block text-sm font-semibold leading-tight">{n.label}</span>
                  <span className={`block text-[11px] ${active ? "text-slate-500" : "text-slate-400"}`}>
                    {n.desc}
                  </span>
                </span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-4">
          <div className="rounded-xl bg-white/5 p-3 text-[11px] leading-relaxed text-slate-300 ring-1 ring-white/10">
            <p className="font-semibold text-white">⛔ Core guarantee</p>
            Once a batch enters reverse logistics it can never be sold again. Blocked sales raise regulator alerts.
          </div>
        </div>
      </aside>
      {open && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />
      )}
    </>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100">
      <Sidebar />
      <main className="min-h-screen p-4 pl-4 pt-16 sm:p-6 lg:pl-[17rem] lg:pt-6">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>
      {right && <div className="flex flex-wrap gap-2">{right}</div>}
    </div>
  );
}

export function Card({
  title,
  subtitle,
  children,
  action,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            {title && <h2 className="text-sm font-bold text-slate-900">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Toast({ msg, kind }: { msg: string; kind: "ok" | "err" | "info" }) {
  const styles =
    kind === "ok"
      ? "bg-emerald-600"
      : kind === "err"
        ? "bg-red-600"
        : "bg-slate-900";
  return (
    <div
      className={`fixed bottom-6 left-1/2 z-[60] max-w-[92vw] -translate-x-1/2 rounded-xl px-5 py-3 text-sm font-medium text-white shadow-2xl ${styles}`}
    >
      {msg}
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}

export function ActorSelect({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  label: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

export function IntegrityPill({ valid, compact }: { valid: boolean; compact?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 font-bold ring-1 ring-inset ${
        compact ? "py-0.5 text-[11px]" : "py-1 text-xs"
      } ${valid ? "bg-emerald-100 text-emerald-800 ring-emerald-600/20" : "bg-red-100 text-red-800 ring-red-600/30"}`}
    >
      {valid ? "✓ VERIFIED" : "⚠ INTEGRITY FAILURE"}
    </span>
  );
}
