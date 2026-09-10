import { useEffect, useState } from "react";
import { fetchLedger, type AuditEvent } from "../api/client";
import { EventBadge } from "../components/StatusBadge";

export function AuditLedger() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [integrity, setIntegrity] = useState<{ valid: boolean } | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => { fetchLedger().then((d) => { setEvents(d.audit_events); setIntegrity(d.integrity); }).catch(() => {}); }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold">Cryptographic Audit Ledger</h1>
      <p className="text-sm text-slate-500">Append-only SHA-256 hash chain + Ed25519 — stored in PostgreSQL. No blockchain. {integrity && (integrity.valid ? "✅ VALID" : "🚨 INVALID")}</p>
      <div className="mt-4 space-y-3">
        {events.map((t) => (
          <div key={t.id} className="rounded-xl border bg-white">
            <button onClick={() => setExpanded(expanded === t.id ? null : t.id)} className="block w-full p-4 text-left">
              <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-xs font-bold text-white">EVENT #{t.id}</span>{" "}
              <span className="font-mono text-xs font-bold">{t.batch_id}</span> <EventBadge eventType={t.event_type} />{" "}
              <span className={`text-[11px] font-bold ${t.hash_valid && t.signature_valid ? "text-emerald-700" : "text-red-700"}`}>{t.hash_valid && t.signature_valid ? "✓ hash · ✓ sig" : "✗ INVALID"}</span>
              <p className="mt-1 text-sm text-slate-700">{String(t.event_data?.remarks ?? "—")}</p>
              <p className="truncate font-mono text-[10px] text-slate-400">hash: {t.event_hash}</p>
            </button>
            {expanded === t.id && (
              <div className="grid gap-3 border-t p-4 text-xs md:grid-cols-2">
                <pre className="max-h-56 overflow-auto rounded-lg bg-slate-950 p-3 font-mono text-[11px] text-emerald-300">{JSON.stringify(t.event_data, null, 2)}</pre>
                <div className="space-y-2">
                  <p><b>Actor:</b> {t.actor_name} ({t.actor_id} · {t.actor_role})</p>
                  <p className="break-all font-mono text-[11px]"><b>prev:</b> {t.previous_hash}</p>
                  <p className="break-all font-mono text-[11px]"><b>hash:</b> {t.event_hash}</p>
                  <p className="break-all font-mono text-[11px]"><b>sig:</b> {t.digital_signature}</p>
                  <p><b>Hash:</b> {t.hash_valid ? "✓" : "✗"} <b>Signature:</b> {t.signature_valid ? "✓" : "✗"}</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
