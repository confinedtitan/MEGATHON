"use client";
import { useCallback, useEffect, useState } from "react";
import {
  AuditEvent,
  Batch,
  fetchAuditLedger,
  fetchBatches,
  seedDemo,
  tamperDemo,
} from "@/lib/client";
import { Card, Empty, EventBadge, IntegrityPill, PageHeader, Shell, Toast } from "@/components/ui";

export default function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [integrity, setIntegrity] = useState<{
    valid: boolean;
    events: number;
    batches?: number;
    signatures?: number;
    invalid_batch?: string;
    invalid_record_id?: number;
    reason?: string;
  } | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [tamperTarget, setTamperTarget] = useState("");
  const [tampering, setTampering] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" | "info" } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [l, b] = await Promise.all([fetchAuditLedger(filter || undefined), fetchBatches()]);
      setEvents(l.audit_events);
      setIntegrity(l.integrity);
      setBatches(b);
      if (!tamperTarget && b.length > 0) {
        const withHistory = b.find((x) => x.currentStatus === "DESTROYED") ?? b[0];
        setTamperTarget(withHistory.batchNumber);
      }
    } catch {
      setToast({ msg: "Failed to load. Load demo data from Overview.", kind: "err" });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  async function runTamper() {
    if (!tamperTarget) return;
    setTampering(true);
    try {
      const r = await tamperDemo(tamperTarget);
      setToast({
        msg: `Record #${r.tampered_record_id} modified out-of-band — verification will now report HASH_CHAIN_TAMPER_DETECTED`,
        kind: "info",
      });
      await load();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Tamper demo failed";
      setToast({ msg, kind: "err" });
    } finally {
      setTampering(false);
    }
  }

  async function restore() {
    try {
      await seedDemo();
      setToast({ msg: "Demo data restored — hash chains valid again", kind: "ok" });
      await load();
    } catch {
      setToast({ msg: "Restore failed", kind: "err" });
    }
  }

  return (
    <Shell>
      <PageHeader
        title="Cryptographic Audit Ledger"
        subtitle="Append-only SHA-256 hash chain with Ed25519 signatures — stored entirely in PostgreSQL. No blockchain."
        right={
          <button
            onClick={load}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700"
          >
            ↻ Refresh
          </button>
        }
      />

      <div className="grid gap-3 lg:grid-cols-3">
        <Card title="🔏 Hash-chain integrity" subtitle="Recomputed live on every load">
          {integrity ? (
            <div className="flex items-center gap-3">
              <span
                className={`grid h-12 w-12 place-items-center rounded-2xl text-2xl ${
                  integrity.valid ? "bg-emerald-100" : "bg-red-100"
                }`}
              >
                {integrity.valid ? "✅" : "🚨"}
              </span>
              <div>
                <IntegrityPill valid={integrity.valid} />
                <p className="mt-1 text-xs text-slate-500">
                  {integrity.events} signed events
                  {integrity.batches !== undefined && ` · ${integrity.batches} batches`}
                  {integrity.signatures !== undefined && ` · ${integrity.signatures} signatures`}
                </p>
                {!integrity.valid && (
                  <p className="mt-1 font-mono text-[11px] font-bold text-red-700">
                    {integrity.invalid_batch && <span>Batch {integrity.invalid_batch} · </span>}
                    Invalid record: #{integrity.invalid_record_id} · {integrity.reason}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">…</p>
          )}
        </Card>
        <Card title="How events are sealed" subtitle="Deterministic · reproducible · verifiable">
          <p className="font-mono text-[11px] leading-relaxed text-slate-600">
            event_hash = SHA256(
            <br />
            &nbsp;&nbsp;batch_id | event_type
            <br />
            &nbsp;&nbsp;| canonical(event_data)
            <br />
            &nbsp;&nbsp;| actor_id | timestamp
            <br />
            &nbsp;&nbsp;| previous_hash
            <br />)
            <br />
            signature = Ed25519_Sign(private_key, event_hash)
          </p>
        </Card>
        <Card title="Filter by batch" subtitle="Reconstruct one batch's audit trail">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          >
            <option value="">All batches (latest 200 events)</option>
            {batches.map((b) => (
              <option key={b.id} value={b.batchNumber}>
                {b.batchNumber} — {b.medicineName}
              </option>
            ))}
          </select>
          <p className="mt-2 text-[11px] text-slate-500">
            The audit table is append-only: the application exposes no update or delete endpoint for
            audit records.
          </p>
        </Card>
      </div>

      {/* Tamper demo */}
      <div className="mt-6">
        <Card
          title="🧪 Tamper-detection demonstration"
          subtitle="Simulates an attacker with direct database access — then proves verification catches it"
        >
          <div className="flex flex-wrap items-end gap-3">
            <label className="block min-w-[220px] flex-1">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Batch to tamper with
              </span>
              <select
                value={tamperTarget}
                onChange={(e) => setTamperTarget(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm outline-none focus:border-slate-900"
              >
                {batches.map((b) => (
                  <option key={b.id} value={b.batchNumber}>
                    {b.batchNumber} — {b.currentStatus}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={runTamper}
              disabled={tampering || !tamperTarget}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-500 disabled:opacity-50"
            >
              {tampering ? "Tampering…" : "⚠ Simulate database tampering"}
            </button>
            <button
              onClick={restore}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              ↻ Restore demo data
            </button>
          </div>
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 ring-1 ring-amber-200">
            The simulator issues a raw <span className="font-mono font-bold">UPDATE audit_events …</span>{" "}
            directly against PostgreSQL — exactly what the application never allows normal users to do.
            Afterwards every integrity check for that batch reports{" "}
            <span className="font-mono font-bold">HASH_CHAIN_TAMPER_DETECTED</span> with the invalid
            record id. The audit trail is cryptographically <b>tamper-evident</b>: any modification,
            deletion, insertion, or reordering of historical events breaks hash and/or signature
            verification.
          </p>
        </Card>
      </div>

      <div className="mt-6">
        <Card title={`Signed audit events (${events.length})`} subtitle="Newest first · click an event for full cryptographic proof">
          {loading ? (
            <p className="py-8 text-center text-sm text-slate-500">Loading audit ledger…</p>
          ) : events.length === 0 ? (
            <Empty text="No audit events yet. Load demo data from Overview." />
          ) : (
            <div className="space-y-3">
              {events.map((t) => (
                <div key={t.id} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/50">
                  <button
                    onClick={() => setExpanded(expanded === t.id ? null : t.id)}
                    className="block w-full p-4 text-left"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-lg bg-slate-900 px-2.5 py-1 font-mono text-xs font-bold text-white">
                        EVENT #{t.id}
                      </span>
                      <span className="rounded-lg bg-white px-2.5 py-1 font-mono text-xs font-bold text-slate-700 ring-1 ring-slate-200">
                        {t.batchId}
                      </span>
                      <EventBadge eventType={t.eventType} />
                      {t.hashValid && t.signatureValid ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800 ring-1 ring-inset ring-emerald-600/20">
                          ✓ hash · ✓ signature
                        </span>
                      ) : (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-800 ring-1 ring-inset ring-red-600/30">
                          {!t.hashValid ? "✗ hash" : "✓ hash"} · {!t.signatureValid ? "✗ signature" : "✓ signature"}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-slate-700">
                      {String(t.eventData?.remarks ?? t.eventData?.reason ?? "—")}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                      <span>👤 {t.actorRole} · {t.actorName ?? t.actorId}</span>
                      <span className="font-mono">{t.actorId}</span>
                      <span>🕒 {new Date(t.timestamp).toLocaleString()}</span>
                      {Boolean(t.eventData?.from_state || t.eventData?.to_state) && (
                        <span className="font-mono">
                          {String(t.eventData?.from_state ?? "?")} → {String(t.eventData?.to_state ?? "?")}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 grid gap-1 font-mono text-[10px] text-slate-400">
                      <p className="truncate" title={t.previousHash}>prev: {t.previousHash}</p>
                      <p className="truncate" title={t.eventHash}>hash: {t.eventHash}</p>
                    </div>
                  </button>
                  {expanded === t.id && (
                    <div className="border-t border-slate-200 bg-white p-4">
                      <div className="grid gap-3 text-xs md:grid-cols-2">
                        <div>
                          <p className="font-bold uppercase tracking-wide text-slate-500">Event data (canonical JSON hashed)</p>
                          <pre className="slim-scroll mt-1 max-h-56 overflow-auto rounded-lg bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-emerald-300">
                            {JSON.stringify(t.eventData, null, 2)}
                          </pre>
                        </div>
                        <div className="space-y-2">
                          <div className="rounded-lg bg-slate-50 p-2.5 ring-1 ring-slate-100">
                            <p className="font-bold text-slate-500">Actor</p>
                            <p className="mt-0.5 font-semibold text-slate-800">{t.actorName ?? "—"} <span className="font-mono text-[11px] text-slate-500">({t.actorId} · {t.actorRole})</span></p>
                            <p className="text-slate-500">{new Date(t.timestamp).toLocaleString()}</p>
                          </div>
                          <div className="rounded-lg bg-slate-50 p-2.5 ring-1 ring-slate-100">
                            <p className="font-bold text-slate-500">Previous hash</p>
                            <p className="mt-0.5 break-all font-mono text-[11px]">{t.previousHash}</p>
                          </div>
                          <div className="rounded-lg bg-slate-50 p-2.5 ring-1 ring-slate-100">
                            <p className="font-bold text-slate-500">Event hash (SHA-256)</p>
                            <p className="mt-0.5 break-all font-mono text-[11px]">{t.eventHash}</p>
                          </div>
                          <div className="rounded-lg bg-slate-50 p-2.5 ring-1 ring-slate-100">
                            <p className="font-bold text-slate-500">Digital signature (Ed25519, base64)</p>
                            <p className="mt-0.5 break-all font-mono text-[11px]">{t.digitalSignature}</p>
                          </div>
                          <div className="flex gap-2">
                            <span className={`flex-1 rounded-lg px-3 py-2 text-center font-bold ${t.hashValid ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                              Hash: {t.hashValid ? "✓ VALID" : "✗ INVALID"}
                            </span>
                            <span className={`flex-1 rounded-lg px-3 py-2 text-center font-bold ${t.signatureValid ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                              Signature: {t.signatureValid ? "✓ VALID" : "✗ INVALID"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {toast && <Toast msg={toast.msg} kind={toast.kind} />}
    </Shell>
  );
}
