import { useState } from "react";
import { verifyBatch } from "../api/client";
import { QrScanner } from "./QrScanner";
import { StatusBadge } from "./StatusBadge";

export function VerifyWidget({ pharmacyName }: { pharmacyName: string }) {
  const [batchNumber, setBatchNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ allowed: boolean; reason?: string; message?: string; status?: string; medicine_name?: string; batch_id?: string; alert_id?: number } | null>(null);

  async function run() {
    if (!batchNumber.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      setResult(await verifyBatch(batchNumber.trim(), pharmacyName));
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Verification failed";
      setResult({ allowed: false, reason: "ERROR", message: msg });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <QrScanner onScan={setBatchNumber} label="POS scanner" />
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900">🛒 Simulated POS — Verify Before Sale</h2>
        <div className="mt-3 flex gap-2">
          <input value={batchNumber} onChange={(e) => setBatchNumber(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === "Enter" && run()} placeholder="Batch number" className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm outline-none focus:border-slate-900" />
          <button onClick={run} disabled={loading || !batchNumber.trim()} className="shrink-0 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-50">
            {loading ? "Verifying…" : "Verify Before Sale"}
          </button>
        </div>
        {result && (
          <div className={`mt-4 rounded-xl p-4 ring-1 ${result.allowed ? "bg-emerald-50 ring-emerald-500/30" : "bg-red-50 ring-red-500/30"}`}>
            <div className="flex flex-wrap items-center gap-3">
              <span className={`rounded-lg px-4 py-2 text-sm font-black text-white ${result.allowed ? "bg-emerald-600" : "bg-red-600"}`}>
                {result.allowed ? "✓ SALE ALLOWED" : "⛔ SALE BLOCKED"}
              </span>
              {result.status && <StatusBadge status={result.status} />}
            </div>
            <p className="mt-2 font-mono text-xs font-bold">{result.reason}</p>
            <p className="text-sm text-slate-700">{result.message}</p>
            {!result.allowed && result.alert_id && (
              <p className="mt-1 text-xs font-semibold text-red-700">⚠ Signed SALE_BLOCKED event · fraud alert #{result.alert_id}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
