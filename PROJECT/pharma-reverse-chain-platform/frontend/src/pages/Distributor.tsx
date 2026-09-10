import { useEffect, useState } from "react";
import { fetchBatches, postTransition, type Batch } from "../api/client";
import { StatusBadge } from "../components/StatusBadge";

export function Distributor() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [counts, setCounts] = useState<Record<number, string>>({});
  const load = () => fetchBatches().then((all) => setBatches(all.filter((b) => ["LOGGED_FOR_RETURN", "PICKUP_SCHEDULED", "RECEIVED_BY_DISTRIBUTOR", "DISPUTED"].includes(b.current_status)))).catch(() => {});
  useEffect(() => { load(); }, []);

  async function act(b: Batch, action: string, body: Record<string, unknown> = {}) {
    await postTransition(b.id, action, body);
    load();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Distributor Dashboard</h1>
      <p className="text-sm text-slate-500">Pickup scheduling · receipt with quantity verification · disputes.</p>
      <div className="mt-4 rounded-2xl border bg-white p-5 shadow-sm">
        <table className="w-full min-w-[720px] text-sm">
          <thead><tr className="text-left text-[11px] uppercase text-slate-500"><th className="px-3 py-2">Batch</th><th className="px-3 py-2">Declared</th><th className="px-3 py-2">Status</th><th className="px-3 py-2 text-right">Actions</th></tr></thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.id} className="border-b hover:bg-slate-50">
                <td className="px-3 py-2 font-mono text-xs font-bold">{b.batch_number}<br /><span className="font-sans font-normal text-slate-500">{b.medicine_name}</span></td>
                <td className="px-3 py-2">{b.quantity}</td>
                <td className="px-3 py-2"><StatusBadge status={b.current_status} /></td>
                <td className="px-3 py-2"><div className="flex flex-wrap justify-end gap-2">
                  {b.current_status === "LOGGED_FOR_RETURN" && <button onClick={() => act(b, "schedule-pickup", { remarks: "Pickup scheduled" })} className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-bold text-white">🚚 Schedule pickup</button>}
                  {b.current_status === "PICKUP_SCHEDULED" && (<>
                    <input value={counts[b.id] ?? ""} onChange={(e) => setCounts((c) => ({ ...c, [b.id]: e.target.value }))} placeholder={`Count (${b.quantity})`} className="w-32 rounded-lg border px-2 py-1.5 text-xs" />
                    <button onClick={() => act(b, "receive", counts[b.id] ? { received_quantity: Number(counts[b.id]) } : {})} className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white">📦 Receive</button>
                    <button onClick={() => act(b, "raise-dispute", { reason: "Damaged packaging" })} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white">⚠ Dispute</button>
                  </>)}
                  {b.current_status === "DISPUTED" && <button onClick={() => act(b, "resolve-dispute", { resolution: "Recount OK — reconciled" })} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white">✓ Resolve</button>}
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {batches.length === 0 && <p className="py-8 text-center text-sm text-slate-500">Queue empty.</p>}
      </div>
    </div>
  );
}
