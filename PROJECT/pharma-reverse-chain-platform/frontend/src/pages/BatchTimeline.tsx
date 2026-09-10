import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { EventBadge, IntegrityPill, StatusBadge } from "../components/StatusBadge";
import type { AuditEvent, Batch } from "../api/client";

export function BatchTimeline() {
  const { batchNumber } = useParams();
  const [batch, setBatch] = useState<Batch | null>(null);
  const [history, setHistory] = useState<AuditEvent[]>([]);
  const [integrity, setIntegrity] = useState<{ integrity_valid: boolean; events_verified?: number; signatures_verified?: number; invalid_record_id?: number } | null>(null);

  useEffect(() => {
    api.get(`/batch/number/${batchNumber}`).then((r) => { setBatch(r.data.batch); setHistory(r.data.history); });
    api.get(`/batches/${batchNumber}/verify-integrity`).then((r) => setIntegrity(r.data)).catch(() => {});
  }, [batchNumber]);

  if (!batch) return <p>Loading…</p>;

  return (
    <div>
      <h1 className="font-mono text-2xl font-black">{batch.batch_number}</h1>
      <p className="text-lg font-bold">{batch.medicine_name} <StatusBadge status={batch.current_status} /></p>
      <div className="mt-3 rounded-2xl border bg-white p-4">
        {integrity && <IntegrityPill valid={integrity.integrity_valid} />}
        {integrity?.integrity_valid && <p className="mt-2 text-sm text-emerald-700">✓ {integrity.events_verified} events · ✓ {integrity.signatures_verified} signatures</p>}
        {integrity && !integrity.integrity_valid && <p className="mt-2 font-mono text-sm font-bold text-red-700">⚠ INTEGRITY FAILURE · Invalid record #{integrity.invalid_record_id}</p>}
      </div>
      <ol className="mt-4 border-l-2 border-slate-200">
        {history.map((t) => (
          <li key={t.id} className="relative ml-4 pb-4">
            <span className={`absolute -left-[25px] top-2 h-3 w-3 rounded-full ${t.hash_valid && t.signature_valid ? "bg-emerald-500" : "bg-red-500"}`} />
            <div className="rounded-xl bg-white p-3 ring-1 ring-slate-100">
              <EventBadge eventType={t.event_type} /> <span className="font-mono text-[11px] text-slate-500">#{t.id} · {t.actor_role} · {t.actor_name}</span>
              <p className="text-sm">{String(t.event_data?.remarks ?? "—")}</p>
              <p className="truncate font-mono text-[10px] text-slate-400">Hash: {t.event_hash}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
