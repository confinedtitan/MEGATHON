"use client";
import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AuditEvent, Batch, fetchBatchByNumber, tamperDemo } from "@/lib/client";
import {
  Card,
  Empty,
  EventBadge,
  IntegrityPill,
  PageHeader,
  Shell,
  StatusBadge,
  Toast,
} from "@/components/ui";

export default function BatchTimelinePage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = use(params);
  const batchNumber = decodeURIComponent(batchId);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [history, setHistory] = useState<AuditEvent[]>([]);
  const [integrity, setIntegrity] = useState<{
    valid: boolean;
    events?: number;
    signatures?: number;
    invalid_record_id?: number;
    reason?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" | "info" } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetchBatchByNumber(batchNumber);
      setBatch(r.batch);
      setHistory(r.history);
      setIntegrity(r.integrity);
    } catch {
      setToast({ msg: "Batch not found.", kind: "err" });
    } finally {
      setLoading(false);
    }
  }, [batchNumber]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  async function runTamper() {
    try {
      const r = await tamperDemo(batchNumber);
      setToast({
        msg: `Record #${r.tampered_record_id} tampered — integrity now reports HASH_CHAIN_TAMPER_DETECTED`,
        kind: "info",
      });
      await load();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Tamper demo failed";
      setToast({ msg, kind: "err" });
    }
  }

  return (
    <Shell>
      <PageHeader
        title={batchNumber}
        subtitle="Batch details · complete cryptographic audit timeline · integrity verification."
        right={
          <>
            <Link
              href="/regulator"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              ← Regulator
            </Link>
            <button
              onClick={load}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700"
            >
              ↻ Re-verify
            </button>
          </>
        }
      />

      {loading ? (
        <Card>
          <p className="py-8 text-center text-sm text-slate-500">Loading batch timeline…</p>
        </Card>
      ) : !batch ? (
        <Card>
          <Empty text="Batch not found." />
        </Card>
      ) : (
        <>
          {/* Header */}
          <div className="grid gap-3 lg:grid-cols-3">
            <Card title={batch.medicineName} subtitle={`Batch ${batch.batchNumber}`}>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={batch.currentStatus} />
                {batch.currentStatus === "DESTROYED" && <span className="text-lg">🔒</span>}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg bg-slate-50 p-2.5">
                  <dt className="text-[10px] font-semibold uppercase text-slate-500">Manufacturer</dt>
                  <dd className="font-semibold">{batch.manufacturerName}</dd>
                </div>
                <div className="rounded-lg bg-slate-50 p-2.5">
                  <dt className="text-[10px] font-semibold uppercase text-slate-500">Expiry</dt>
                  <dd className="font-semibold">{batch.expiryDate}</dd>
                </div>
                <div className="rounded-lg bg-slate-50 p-2.5">
                  <dt className="text-[10px] font-semibold uppercase text-slate-500">Quantity</dt>
                  <dd className="font-semibold">{batch.quantity.toLocaleString()}</dd>
                </div>
                <div className="rounded-lg bg-slate-50 p-2.5">
                  <dt className="text-[10px] font-semibold uppercase text-slate-500">Created</dt>
                  <dd className="font-semibold">{new Date(batch.createdAt).toLocaleDateString()}</dd>
                </div>
              </dl>
              {batch.discrepancyReason && (
                <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800 ring-1 ring-red-200">
                  <p className="font-bold">Discrepancy</p>
                  <p>{batch.discrepancyReason}</p>
                </div>
              )}
              {batch.certificateHash && (
                <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs ring-1 ring-slate-200">
                  <p className="font-bold text-slate-700">Destruction certificate SHA-256</p>
                  <p className="mt-1 break-all font-mono text-slate-600">{batch.certificateHash}</p>
                  <p className="mt-1 text-slate-500">File: {batch.certificateFilename}</p>
                </div>
              )}
            </Card>

            <Card title="🔏 Integrity verification" subtitle={`GET /batches/${batchNumber}/verify-integrity`}>
              {integrity ? (
                integrity.valid ? (
                  <div className="space-y-2 text-sm">
                    <IntegrityPill valid />
                    <p className="text-slate-700">
                      Status: <StatusBadge status={batch.currentStatus} />{" "}
                      {batch.currentStatus === "DESTROYED" && "🔒"}
                    </p>
                    <p className="text-emerald-700 font-semibold">✓ {integrity.events} events</p>
                    <p className="text-emerald-700 font-semibold">✓ {integrity.events} hashes</p>
                    <p className="text-emerald-700 font-semibold">✓ {integrity.signatures} signatures</p>
                    <button
                      onClick={runTamper}
                      className="mt-2 w-full rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-500"
                    >
                      ⚠ Simulate tampering on this batch
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 text-sm">
                    <IntegrityPill valid={false} />
                    <div className="rounded-xl bg-red-50 p-3 ring-1 ring-red-200">
                      <p className="font-bold text-red-800">⚠ INTEGRITY FAILURE</p>
                      <p className="mt-1 text-red-700">Batch: <span className="font-mono font-bold">{batchNumber}</span></p>
                      <p className="text-red-700">Invalid record: <span className="font-mono font-bold">#{integrity.invalid_record_id}</span></p>
                      <p className="text-red-700">Hash chain: <b>INVALID</b> · Signature: <b>INVALID</b></p>
                      <p className="mt-1 font-mono text-[11px] text-red-600">{integrity.reason}</p>
                    </div>
                    <p className="text-xs text-slate-500">
                      Restore pristine demo data from the Overview page (“Load demo data”).
                    </p>
                  </div>
                )
              ) : (
                <p className="text-sm text-slate-500">…</p>
              )}
            </Card>

            <Card title="How to read this timeline" subtitle="Every node is a signed audit event">
              <ul className="space-y-2 text-[13px] text-slate-600">
                <li>⬇ Each event links to the previous event&apos;s hash.</li>
                <li>✍ Each event is signed by the acting stakeholder (Ed25519).</li>
                <li>🔍 Click any event for full cryptographic proof.</li>
                <li>🔒 Corrections are appended as new events — history never changes.</li>
              </ul>
            </Card>
          </div>

          {/* Timeline */}
          <div className="mt-6">
            <Card
              title={`Audit timeline — ${history.length} signed events`}
              subtitle="Chronological · reconstructed from the append-only audit_events table"
            >
              {history.length === 0 ? (
                <Empty text="No audit events for this batch." />
              ) : (
                <ol className="relative space-y-0 border-l-2 border-slate-200 pl-0">
                  {history.map((t, i) => (
                    <li key={t.id}>
                      <div className="relative ml-4 pb-2">
                        <span
                          className={`absolute -left-[25px] top-3 h-3 w-3 rounded-full ring-4 ring-slate-100 ${
                            t.hashValid && t.signatureValid ? "bg-emerald-500" : "bg-red-500"
                          }`}
                        />
                        <button
                          onClick={() => setSelected(t)}
                          className="block w-full rounded-xl bg-slate-50 p-3 text-left ring-1 ring-slate-100 transition hover:bg-slate-100"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-[11px] font-bold text-white">
                              #{t.id}
                            </span>
                            <EventBadge eventType={t.eventType} />
                            {Boolean(t.eventData?.from_state || t.eventData?.to_state) ? (
                              <span className="font-mono text-[11px] text-slate-500">
                                {String(t.eventData?.from_state ?? "?")} → {String(t.eventData?.to_state ?? "?")}
                              </span>
                            ) : null}
                            {t.hashValid && t.signatureValid ? (
                              <span className="text-[11px] font-bold text-emerald-700">✓ signed</span>
                            ) : (
                              <span className="text-[11px] font-bold text-red-700">✗ INVALID</span>
                            )}
                          </div>
                          <p className="mt-1 text-sm text-slate-700">
                            {String(t.eventData?.remarks ?? t.eventData?.reason ?? "—")}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-500">
                            {t.actorRole} · {t.actorName ?? t.actorId} ·{" "}
                            <span className="font-mono">{t.actorId}</span> ·{" "}
                            {new Date(t.timestamp).toLocaleString()}
                          </p>
                          <p className="mt-1 truncate font-mono text-[10px] text-slate-400" title={t.eventHash}>
                            Hash: {t.eventHash.slice(0, 24)}… — click for proof
                          </p>
                        </button>
                      </div>
                      {i < history.length - 1 && (
                        <div className="ml-[21px] pb-2 text-slate-400">▼</div>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </div>
        </>
      )}

      {/* Event proof modal */}
      {selected && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/50 p-4" onClick={() => setSelected(null)}>
          <div
            className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-slate-900 px-2.5 py-1 font-mono text-xs font-bold text-white">
                  EVENT #{selected.id}
                </span>
                <EventBadge eventType={selected.eventType} />
              </div>
              <button onClick={() => setSelected(null)} className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-600 hover:bg-slate-200">
                ✕
              </button>
            </div>
            <div className="mt-4 grid gap-3 text-xs md:grid-cols-2">
              <div>
                <p className="font-bold uppercase tracking-wide text-slate-500">Event data</p>
                <pre className="slim-scroll mt-1 max-h-72 overflow-auto rounded-lg bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-emerald-300">
                  {JSON.stringify(selected.eventData, null, 2)}
                </pre>
              </div>
              <div className="space-y-2">
                <div className="rounded-lg bg-slate-50 p-2.5 ring-1 ring-slate-100">
                  <p className="font-bold text-slate-500">Actor / role</p>
                  <p className="mt-0.5 font-semibold">{selected.actorName ?? "—"}</p>
                  <p className="font-mono text-[11px] text-slate-600">{selected.actorId} · {selected.actorRole}</p>
                  <p className="text-slate-500">{new Date(selected.timestamp).toLocaleString()}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-2.5 ring-1 ring-slate-100">
                  <p className="font-bold text-slate-500">Previous hash</p>
                  <p className="mt-0.5 break-all font-mono text-[11px]">{selected.previousHash}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-2.5 ring-1 ring-slate-100">
                  <p className="font-bold text-slate-500">Event hash (SHA-256)</p>
                  <p className="mt-0.5 break-all font-mono text-[11px]">{selected.eventHash}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-2.5 ring-1 ring-slate-100">
                  <p className="font-bold text-slate-500">Digital signature (Ed25519)</p>
                  <p className="mt-0.5 break-all font-mono text-[11px]">{selected.digitalSignature}</p>
                </div>
                <div className="flex gap-2">
                  <span className={`flex-1 rounded-lg px-3 py-2 text-center font-bold ${selected.hashValid ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                    Hash {selected.hashValid ? "✓" : "✗"}
                  </span>
                  <span className={`flex-1 rounded-lg px-3 py-2 text-center font-bold ${selected.signatureValid ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                    Signature {selected.signatureValid ? "✓" : "✗"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast msg={toast.msg} kind={toast.kind} />}
    </Shell>
  );
}
