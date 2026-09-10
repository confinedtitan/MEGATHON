"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { fetchStats, seedDemo } from "@/lib/client";
import { Card, PageHeader, Shell, StatusBadge, Toast } from "@/components/ui";
import { VerifyWidget } from "@/components/widgets";

const FLOW = [
  { s: "ACTIVE", who: "Pharmacy stock" },
  { s: "LOGGED_FOR_RETURN", who: "Pharmacy" },
  { s: "PICKUP_SCHEDULED", who: "Distributor" },
  { s: "RECEIVED_BY_DISTRIBUTOR", who: "Distributor" },
  { s: "WAITING_FOR_DESTRUCTION", who: "Manufacturer" },
  { s: "DESTROYED", who: "Manufacturer" },
];

const ROLES = [
  {
    href: "/pharmacy",
    icon: "✚",
    title: "Pharmacy",
    desc: "View stock, log returns, verify every sale at POS.",
    color: "from-emerald-400 to-teal-600",
  },
  {
    href: "/distributor",
    icon: "▣",
    title: "Distributor",
    desc: "Schedule pickups, verify quantities, raise & resolve disputes.",
    color: "from-sky-400 to-blue-600",
  },
  {
    href: "/manufacturer",
    icon: "⬢",
    title: "Manufacturer",
    desc: "Accept batches for destruction, upload certificates, destroy.",
    color: "from-violet-400 to-purple-600",
  },
  {
    href: "/regulator",
    icon: "◎",
    title: "Regulator",
    desc: "Full oversight: batches, integrity verification, fraud alerts.",
    color: "from-amber-400 to-orange-600",
  },
];

export default function HomePage() {
  const [stats, setStats] = useState<{
    totalBatches: number;
    byStatus: Record<string, number>;
    totalAuditEvents: number;
    totalAlerts: number;
    blockedBatches: number;
    sellableBatches: number;
  } | null>(null);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" | "info" } | null>(null);
  const [seeding, setSeeding] = useState(false);

  const load = useCallback(async () => {
    try {
      setStats(await fetchStats());
    } catch {
      /* db not seeded yet */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  async function seed() {
    setSeeding(true);
    try {
      await seedDemo();
      setToast({ msg: "Demo data loaded — 10 batches across all lifecycle stages", kind: "ok" });
      await load();
    } catch {
      setToast({ msg: "Seeding failed — is the database running?", kind: "err" });
    } finally {
      setSeeding(false);
    }
  }

  return (
    <Shell>
      <PageHeader
        title="Reverse Chain Command Center"
        subtitle="Expired, returned, disputed or destroyed batches must never be sellable again."
        right={
          <>
            <Link
              href="/docs"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              📖 Setup & API docs
            </Link>
            <button
              onClick={seed}
              disabled={seeding}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {seeding ? "Loading demo data…" : "↻ Load demo data"}
            </button>
          </>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: "Total batches", value: stats?.totalBatches ?? "—", sub: "tracked" },
          { label: "Sellable (ACTIVE)", value: stats?.sellableBatches ?? "—", sub: "POS allows sale", green: true },
          { label: "Blocked from sale", value: stats?.blockedBatches ?? "—", sub: "in reverse chain", red: true },
          { label: "Signed audit events", value: stats?.totalAuditEvents ?? "—", sub: "hash-chained" },
          { label: "Fraud alerts", value: stats?.totalAlerts ?? "—", sub: "blocked attempts" },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{k.label}</p>
            <p
              className={`mt-1 text-3xl font-black ${
                k.green ? "text-emerald-600" : k.red ? "text-red-600" : "text-slate-900"
              }`}
            >
              {k.value}
            </p>
            <p className="text-xs text-slate-400">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Lifecycle */}
      <div className="mt-6">
        <Card
          title="Batch lifecycle — guarded state machine + signed audit trail"
          subtitle="Every arrow is a guarded transition that appends a SHA-256 hash-chained, Ed25519-signed audit event. Invalid moves are rejected with HTTP 422."
        >
          <div className="flex flex-wrap items-center gap-2">
            {FLOW.map((f, i) => (
              <div key={f.s} className="flex items-center gap-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center">
                  <StatusBadge status={f.s} />
                  <p className="mt-1 text-[10px] font-medium text-slate-500">{f.who}</p>
                  {stats?.byStatus?.[f.s] !== undefined && (
                    <p className="text-xs font-black text-slate-900">{stats.byStatus[f.s]} batches</p>
                  )}
                </div>
                {i < FLOW.length - 1 && <span className="font-bold text-slate-400">→</span>}
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <StatusBadge status="DISPUTED" />
            <span>
              ↔ side state: quantity mismatch at receipt moves a batch here via a signed{" "}
              <span className="font-mono font-semibold">QUANTITY_DISCREPANCY</span> event; a{" "}
              <span className="font-mono font-semibold">DISPUTE_RESOLVED</span> reconciliation event
              returns it to <span className="font-mono font-semibold">RECEIVED_BY_DISTRIBUTOR</span> —
              history is never rewritten.
            </span>
            {stats?.byStatus?.DISPUTED !== undefined && (
              <span className="font-bold text-red-700">{stats.byStatus.DISPUTED} disputed</span>
            )}
          </div>
        </Card>
      </div>

      {/* Roles */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {ROLES.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
          >
            <div className={`bg-gradient-to-br p-4 text-white ${r.color}`}>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/20 text-xl font-bold">
                {r.icon}
              </span>
              <p className="mt-3 text-lg font-bold">{r.title}</p>
            </div>
            <p className="p-4 text-sm text-slate-600">{r.desc}</p>
            <p className="px-4 pb-4 text-sm font-bold text-slate-900 group-hover:underline">
              Open dashboard →
            </p>
          </Link>
        ))}
      </div>

      {/* Demo flow */}
      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        <Card
          title="▶ End-to-end demo flow (2 minutes)"
          subtitle="The core guarantee: RETURN → RECEIPT → DESTRUCTION → SALE BLOCKED → ALERT"
        >
          <ol className="space-y-2.5 text-sm text-slate-700">
            {[
              ["1. Pharmacy", "Open Pharmacy, pick an ACTIVE batch, log a return — a signed audit event is appended."],
              ["2. Distributor", "Schedule pickup, then receive with the exact quantity."],
              ["3. Manufacturer", "Move it to waiting-for-destruction, upload a certificate PDF, destroy it."],
              ["4. POS check", "Use Verify Before Sale on that batch number → SALE BLOCKED + signed SALE_BLOCKED event."],
              ["5. Regulator", "Open Regulator — a new fraud alert is waiting, plus per-batch integrity verification."],
              ["6. Integrity", "Open the batch timeline or Audit Ledger, verify the hash chain, then run the tamper demo → HASH_CHAIN_TAMPER_DETECTED."],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
                <span className="shrink-0 self-start rounded-lg bg-slate-900 px-2 py-1 text-[11px] font-bold text-white">
                  {t}
                </span>
                <span>{d}</span>
              </li>
            ))}
          </ol>
        </Card>
        <VerifyWidget defaultPharmacy="CityCare Pharmacy" />
      </div>

      {/* Architecture note */}
      <div className="mt-6">
        <Card title="🔏 Tamper-evident audit architecture (no blockchain)" subtitle="PostgreSQL + SHA-256 + Ed25519">
          <div className="grid gap-3 text-sm text-slate-700 md:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100">
              <p className="font-bold text-slate-900">SHA-256 hash chain</p>
              <p className="mt-1 text-[13px]">Every audit event embeds the previous event&apos;s hash. Any modification, deletion, insertion, or reordering breaks the chain.</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100">
              <p className="font-bold text-slate-900">Ed25519 signatures</p>
              <p className="mt-1 text-[13px]">Each stakeholder signs event hashes with its own private key. Private keys are never stored in the database.</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100">
              <p className="font-bold text-slate-900">Append-only ledger</p>
              <p className="mt-1 text-[13px]">No update or delete API exists for audit records. Corrections are new signed events, never rewrites.</p>
            </div>
          </div>
        </Card>
      </div>

      {toast && <Toast msg={toast.msg} kind={toast.kind} />}
    </Shell>
  );
}
