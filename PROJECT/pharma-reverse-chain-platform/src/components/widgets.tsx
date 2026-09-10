"use client";
import Link from "next/link";
import { useState } from "react";
import { Batch, verifyBatch } from "@/lib/client";
import { StatusBadge } from "@/components/ui";

export function VerifyWidget({ defaultPharmacy }: { defaultPharmacy: string }) {
  const [batchNumber, setBatchNumber] = useState("");
  const [pharmacy, setPharmacy] = useState(defaultPharmacy);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    allowed: boolean;
    reason?: string;
    message?: string;
    status?: string;
    medicine_name?: string;
    batch_id?: string;
    alert_id?: number;
  } | null>(null);

  async function run() {
    if (!batchNumber.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const r = await verifyBatch(batchNumber.trim(), pharmacy);
      setResult(r);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        "Verification failed";
      setResult({ allowed: false, reason: "ERROR", message: msg });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-bold text-slate-900">🛒 Simulated POS — Verify Before Sale</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        Enter a batch number as scanned at the pharmacy counter.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Batch number
          </span>
          <input
            value={batchNumber}
            onChange={(e) => setBatchNumber(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && run()}
            placeholder="e.g. NV-AMX-1001"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Pharmacy
          </span>
          <input
            value={pharmacy}
            onChange={(e) => setPharmacy(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
          />
        </label>
        <div className="flex items-end">
          <button
            onClick={run}
            disabled={loading || !batchNumber.trim()}
            className="w-full rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white shadow transition hover:bg-slate-700 disabled:opacity-50 sm:w-auto"
          >
            {loading ? "Verifying…" : "Verify Before Sale"}
          </button>
        </div>
      </div>
      {result && (
        <div
          className={`mt-4 rounded-xl p-4 ring-1 ${
            result.allowed
              ? "bg-emerald-50 ring-emerald-500/30"
              : "bg-red-50 ring-red-500/30"
          }`}
        >
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`rounded-lg px-4 py-2 text-sm font-black tracking-wide text-white ${
                result.allowed ? "bg-emerald-600" : "bg-red-600"
              }`}
            >
              {result.allowed ? "✓ SALE ALLOWED" : "⛔ SALE BLOCKED"}
            </span>
            {result.status && <StatusBadge status={result.status} />}
          </div>
          <p className="mt-2 font-mono text-xs font-bold text-slate-800">{result.reason}</p>
          <p className="mt-1 text-sm text-slate-700">{result.message}</p>
          {result.medicine_name && (
            <p className="mt-1 text-xs text-slate-500">
              {result.medicine_name} · {result.batch_id}
            </p>
          )}
          {!result.allowed && result.alert_id && (
            <p className="mt-1 text-xs font-semibold text-red-700">
              ⚠ Signed SALE_BLOCKED audit event recorded · fraud alert #{result.alert_id} raised to the regulator.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function BatchDetail({
  batch,
  onClose,
}: {
  batch: Batch;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono text-sm font-bold text-slate-900">{batch.batchNumber}</p>
            <p className="text-lg font-bold text-slate-900">{batch.medicineName}</p>
          </div>
          <button onClick={onClose} className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-600 hover:bg-slate-200">
            ✕
          </button>
        </div>
        <div className="mt-3">
          <StatusBadge status={batch.currentStatus} />
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-slate-50 p-3">
            <dt className="text-[11px] font-semibold uppercase text-slate-500">Manufacturer</dt>
            <dd className="font-semibold">{batch.manufacturerName}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <dt className="text-[11px] font-semibold uppercase text-slate-500">Expiry</dt>
            <dd className="font-semibold">{batch.expiryDate}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <dt className="text-[11px] font-semibold uppercase text-slate-500">Quantity</dt>
            <dd className="font-semibold">{batch.quantity.toLocaleString()} units</dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <dt className="text-[11px] font-semibold uppercase text-slate-500">Created</dt>
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
        <Link
          href={`/batches/${encodeURIComponent(batch.batchNumber)}`}
          className="mt-4 block rounded-xl bg-slate-900 px-4 py-2.5 text-center text-sm font-bold text-white hover:bg-slate-700"
        >
          🔏 View full audit timeline & integrity →
        </Link>
      </div>
    </div>
  );
}
