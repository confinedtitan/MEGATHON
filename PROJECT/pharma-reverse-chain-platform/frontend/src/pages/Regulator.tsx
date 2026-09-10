import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchAlerts, fetchBatches, verifyIntegrity, type Batch } from "../api/client";
import { IntegrityPill, StatusBadge } from "../components/StatusBadge";

export function Regulator() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [alerts, setAlerts] = useState<{ alert_id: number; batch_number: string; pharmacy_name: string; timestamp: string; batch_status: string }[]>([]);
  const [integrity, setIntegrity] = useState<Record<string, { valid: boolean; events: number; sigs: number; bad?: number }>>({});
  const [tab, setTab] = useState<"all" | "alerts" | "integrity">("all");

  useEffect(() => {
    fetchBatches().then(setBatches).catch(() => {});
    fetchAlerts().then(setAlerts).catch(() => {});
  }, []);

  useEffect(() => {
    batches.forEach((b) => {
      if (integrity[b.batch_number]) return;
      verifyIntegrity(b.batch_number).then((v) =>
        setIntegrity((m) => ({ ...m, [b.batch_number]: { valid: v.integrity_valid, events: v.events_verified ?? 0, sigs: v.signatures_verified ?? 0, bad: v.invalid_record_id } }))
      ).catch(() => {});
    });
  }, [batches]);

  return (
    <div>
      <h1 className="text-2xl font-bold">Regulator Dashboard</h1>
      <p className="text-sm text-slate-500">All batches · integrity verification · fraud alerts.</p>
      <div className="mt-4 flex gap-2">
        {(["all", "alerts", "integrity"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-xl px-4 py-2 text-sm font-bold ${tab === t ? "bg-slate-900 text-white" : "bg-white ring-1 ring-slate-200"}`}>{t}</button>
        ))}
      </div>
      {tab === "all" && (
        <div className="mt-4 rounded-2xl border bg-white p-5 shadow-sm">
          <table className="w-full text-sm"><thead><tr className="text-left text-[11px] uppercase text-slate-500"><th className="px-3 py-2">Batch</th><th className="px-3 py-2">Status</th><th className="px-3 py-2 text-right">Timeline</th></tr></thead>
            <tbody>{batches.map((b) => (<tr key={b.id} className="border-b hover:bg-slate-50"><td className="px-3 py-2 font-mono text-xs font-bold">{b.batch_number}<br /><span className="font-sans font-normal text-slate-500">{b.medicine_name}</span></td><td className="px-3 py-2"><StatusBadge status={b.current_status} /></td><td className="px-3 py-2 text-right"><Link to={`/batches/${b.batch_number}`} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white">🔏 Timeline →</Link></td></tr>))}</tbody></table>
        </div>
      )}
      {tab === "alerts" && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-white p-5 shadow-sm">
          {alerts.map((a) => (<div key={a.alert_id} className="mb-2 rounded-xl bg-red-50 p-3 text-sm ring-1 ring-red-100">🚨 <b>#{a.alert_id}</b> <span className="font-mono font-bold">{a.batch_number}</span> · {a.pharmacy_name} · <StatusBadge status={a.batch_status} /></div>))}
          {alerts.length === 0 && <p className="text-sm text-slate-500">No alerts yet.</p>}
        </div>
      )}
      {tab === "integrity" && (
        <div className="mt-4 rounded-2xl border bg-white p-5 shadow-sm">
          <table className="w-full text-sm"><thead><tr className="text-left text-[11px] uppercase text-slate-500"><th className="px-3 py-2">Batch</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Integrity</th><th className="px-3 py-2">Events/Sigs</th></tr></thead>
            <tbody>{batches.map((b) => { const v = integrity[b.batch_number]; return (<tr key={b.id} className="border-b hover:bg-slate-50"><td className="px-3 py-2 font-mono text-xs font-bold">{b.batch_number}</td><td className="px-3 py-2"><StatusBadge status={b.current_status} /></td><td className="px-3 py-2">{v ? <IntegrityPill valid={v.valid} /> : "…"}{v && !v.valid && <p className="font-mono text-[11px] text-red-700">Invalid record #{v.bad}</p>}</td><td className="px-3 py-2">{v ? `✓ ${v.events} / ✓ ${v.sigs}` : "…"}</td></tr>); })}</tbody></table>
        </div>
      )}
    </div>
  );
}
