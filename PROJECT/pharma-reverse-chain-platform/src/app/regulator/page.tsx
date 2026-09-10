"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Alert,
  Batch,
  IntegritySummary,
  fetchAlerts,
  fetchAuditLedger,
  fetchBatches,
  fetchIntegritySummary,
} from "@/lib/client";
import { Card, Empty, IntegrityPill, PageHeader, Shell, StatusBadge, Toast } from "@/components/ui";
import { BatchDetail } from "@/components/widgets";

const ALL_STATUSES = ["ACTIVE", "LOGGED_FOR_RETURN", "PICKUP_SCHEDULED", "RECEIVED_BY_DISTRIBUTOR", "DISPUTED", "WAITING_FOR_DESTRUCTION", "DESTROYED"];

export default function RegulatorPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [summary, setSummary] = useState<IntegritySummary[]>([]);
  const [summaryMeta, setSummaryMeta] = useState({ total: 0, valid: 0, invalid: 0 });
  const [ledgerIntegrity, setLedgerIntegrity] = useState<{
    valid: boolean;
    events: number;
    batches?: number;
  } | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [tab, setTab] = useState<"all" | "destroyed" | "disputed" | "alerts" | "integrity">("all");
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Batch | null>(null);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" | "info" } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [b, a, integ, ledger] = await Promise.all([
        fetchBatches(status || undefined, search || undefined),
        fetchAlerts(),
        fetchIntegritySummary(status || undefined, search || undefined),
        fetchAuditLedger(),
      ]);
      setBatches(b);
      setAlerts(a);
      setSummary(integ.batches);
      setSummaryMeta(integ.summary);
      setLedgerIntegrity(ledger.integrity);
    } catch {
      setToast({ msg: "Failed to load. Load demo data from Overview.", kind: "err" });
    } finally {
      setLoading(false);
    }
  }, [status, search]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const destroyed = batches.filter((b) => b.currentStatus === "DESTROYED");
  const disputed = batches.filter((b) => b.currentStatus === "DISPUTED");

  function BatchTable({ rows }: { rows: Batch[] }) {
    if (rows.length === 0) return <Empty text="No batches in this view." />;
    return (
      <div className="slim-scroll overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[760px] bg-white text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2">Batch</th>
              <th className="px-3 py-2">Medicine</th>
              <th className="px-3 py-2">Expiry</th>
              <th className="px-3 py-2">Qty</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-3 py-2.5 font-mono text-xs font-bold">{b.batchNumber}</td>
                <td className="px-3 py-2.5">{b.medicineName}</td>
                <td className="px-3 py-2.5 text-slate-600">{b.expiryDate}</td>
                <td className="px-3 py-2.5">{b.quantity.toLocaleString()}</td>
                <td className="px-3 py-2.5">
                  <StatusBadge status={b.currentStatus} />
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setDetail(b)}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-100"
                    >
                      View
                    </button>
                    <Link
                      href={`/batches/${encodeURIComponent(b.batchNumber)}`}
                      className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-700"
                    >
                      🔏 Audit timeline
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const tabs: { id: typeof tab; label: string; count?: number }[] = [
    { id: "all", label: "All batches", count: batches.length },
    { id: "destroyed", label: "Destroyed", count: destroyed.length },
    { id: "disputed", label: "Disputed", count: disputed.length },
    { id: "alerts", label: "Fraud alerts", count: alerts.length },
    { id: "integrity", label: "Integrity verification", count: summaryMeta.total },
  ];

  return (
    <Shell>
      <PageHeader
        title="Regulator Dashboard"
        subtitle="National Drug Authority · full oversight of the reverse chain."
        right={
          <span
            className={`rounded-xl px-4 py-2 text-xs font-bold ring-1 ${
              ledgerIntegrity && !ledgerIntegrity.valid
                ? "bg-red-50 text-red-700 ring-red-200"
                : "bg-emerald-50 text-emerald-700 ring-emerald-200"
            }`}
          >
            {ledgerIntegrity
              ? ledgerIntegrity.valid
                ? `🔏 Hash chain VALID · ${ledgerIntegrity.events} signed events`
                : "⚠ HASH CHAIN INVALID — TAMPER DETECTED"
              : "🔏 …"}
          </span>
        }
      />

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { l: "Batches tracked", v: batches.length },
          { l: "Destroyed", v: destroyed.length },
          { l: "Disputed", v: disputed.length },
          { l: "Blocked sale attempts", v: alerts.length },
        ].map((k) => (
          <div key={k.l} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{k.l}</p>
            <p className="mt-1 text-3xl font-black text-slate-900">{k.v}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="mt-4 flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search batch / medicine / manufacturer…"
          className="min-w-[240px] flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-900"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium outline-none"
        >
          <option value="">All statuses</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button
          onClick={load}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="mt-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-xl px-4 py-2 text-sm font-bold ${
              tab === t.id ? "bg-slate-900 text-white shadow" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] ${tab === t.id ? "bg-white/20" : "bg-slate-100"}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {loading ? (
          <Card><p className="py-8 text-center text-sm text-slate-500">Loading regulator view…</p></Card>
        ) : (
          <>
            {tab === "all" && (
              <Card title="All batches" subtitle="Current status of every batch in the system">
                <BatchTable rows={batches} />
              </Card>
            )}
            {tab === "destroyed" && (
              <Card title="Destroyed batches" subtitle="Terminal state — permanently unsellable">
                <BatchTable rows={destroyed} />
              </Card>
            )}
            {tab === "disputed" && (
              <Card title="Disputed batches" subtitle="Quantity / condition mismatches under review">
                <BatchTable rows={disputed} />
              </Card>
            )}
            {tab === "alerts" && (
              <Card
                title="🚨 Fraud alerts — blocked sale attempts"
                subtitle="Every POS verification that hit a non-ACTIVE batch is logged here, with a signed SALE_BLOCKED audit event"
              >
                {alerts.length === 0 ? (
                  <Empty text="No fraud alerts yet. Blocked sales will appear here automatically." />
                ) : (
                  <div className="slim-scroll overflow-x-auto rounded-xl border border-red-200">
                    <table className="w-full min-w-[640px] bg-white text-sm">
                      <thead>
                        <tr className="bg-red-50 text-left text-[11px] uppercase tracking-wide text-red-700">
                          <th className="px-3 py-2">Alert</th>
                          <th className="px-3 py-2">Batch</th>
                          <th className="px-3 py-2">Pharmacy</th>
                          <th className="px-3 py-2">Status at block</th>
                          <th className="px-3 py-2">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {alerts.map((a) => (
                          <tr key={a.alertId} className="border-b border-red-50 hover:bg-red-50/50">
                            <td className="px-3 py-2.5 font-bold text-red-700">#{a.alertId}</td>
                            <td className="px-3 py-2.5 font-mono text-xs font-bold">{a.batchNumber}</td>
                            <td className="px-3 py-2.5">{a.pharmacyName}</td>
                            <td className="px-3 py-2.5">
                              <StatusBadge status={a.batchStatus} />
                            </td>
                            <td className="px-3 py-2.5 text-xs text-slate-500">
                              {new Date(a.timestamp).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            )}
            {tab === "integrity" && (
              <Card
                title="🔏 Integrity verification — every batch"
                subtitle={`Recomputed live: ${summaryMeta.valid} valid · ${summaryMeta.invalid} invalid. Click a batch for its full signed timeline.`}
              >
                {summary.length === 0 ? (
                  <Empty text="No batches in this view." />
                ) : (
                  <div className="slim-scroll overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full min-w-[720px] bg-white text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                          <th className="px-3 py-2">Batch ID</th>
                          <th className="px-3 py-2">Current status</th>
                          <th className="px-3 py-2">Chain integrity</th>
                          <th className="px-3 py-2">Events</th>
                          <th className="px-3 py-2">Signatures</th>
                          <th className="px-3 py-2 text-right">Detail</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.map((s) => (
                          <tr key={s.batch_number} className="border-b border-slate-50 hover:bg-slate-50">
                            <td className="px-3 py-2.5">
                              <p className="font-mono text-xs font-bold">{s.batch_number}</p>
                              <p className="text-[11px] text-slate-500">{s.medicine_name}</p>
                            </td>
                            <td className="px-3 py-2.5">
                              <StatusBadge status={s.status} />
                            </td>
                            <td className="px-3 py-2.5">
                              <IntegrityPill valid={s.integrity_valid} compact />
                              {!s.integrity_valid && (
                                <p className="mt-1 font-mono text-[11px] font-bold text-red-700">
                                  Invalid record: #{s.invalid_record_id}
                                </p>
                              )}
                            </td>
                            <td className="px-3 py-2.5">
                              <span className={s.integrity_valid ? "text-emerald-700 font-bold" : "text-red-700 font-bold"}>
                                {s.integrity_valid ? `✓ ${s.events}` : `✗ ${s.events}`}
                              </span>
                            </td>
                            <td className="px-3 py-2.5">
                              <span className={s.integrity_valid ? "text-emerald-700 font-bold" : "text-red-700 font-bold"}>
                                {s.integrity_valid ? `✓ ${s.signatures}` : "✗ INVALID"}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <Link
                                href={`/batches/${encodeURIComponent(s.batch_number)}`}
                                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-700"
                              >
                                Timeline →
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            )}
          </>
        )}
      </div>

      {detail && <BatchDetail batch={detail} onClose={() => setDetail(null)} />}
      {toast && <Toast msg={toast.msg} kind={toast.kind} />}
    </Shell>
  );
}
