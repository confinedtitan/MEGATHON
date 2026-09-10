import { useEffect, useState } from "react";
import { fetchBatches, postTransition, type Batch } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { StatusBadge } from "../components/StatusBadge";
import { VerifyWidget } from "../components/VerifyWidget";

export function Pharmacy() {
  const { user } = useAuth();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [search, setSearch] = useState("");
  const load = () => fetchBatches(undefined, search || undefined).then(setBatches).catch(() => {});

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); });

  async function logReturn(b: Batch) {
    await postTransition(b.id, "return", { remarks: "Expired stock — return to distributor" });
    load();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Pharmacy Dashboard</h1>
      <p className="text-sm text-slate-500">Acting as {user?.name} · scan · log returns · verify every sale.</p>
      <div className="mt-4"><VerifyWidget pharmacyName={user?.name ?? "CityCare Pharmacy"} /></div>
      <div className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
        <div className="mb-3 flex gap-2">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search batch / medicine…" className="w-full rounded-xl border px-3 py-2 text-sm outline-none" />
          <button onClick={load} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">Search</button>
        </div>
        <table className="w-full min-w-[680px] text-sm">
          <thead><tr className="text-left text-[11px] uppercase text-slate-500"><th className="border-b px-3 py-2">Batch</th><th className="border-b px-3 py-2">Medicine</th><th className="border-b px-3 py-2">Qty</th><th className="border-b px-3 py-2">Status</th><th className="border-b px-3 py-2 text-right">Action</th></tr></thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.id} className="border-b hover:bg-slate-50">
                <td className="px-3 py-2 font-mono text-xs font-bold">{b.batch_number}</td>
                <td className="px-3 py-2">{b.medicine_name}</td>
                <td className="px-3 py-2">{b.quantity}</td>
                <td className="px-3 py-2"><StatusBadge status={b.current_status} /></td>
                <td className="px-3 py-2 text-right">
                  {b.current_status === "ACTIVE" ? (
                    <button onClick={() => logReturn(b)} className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-bold text-white">↩ Log return</button>
                  ) : <span className="text-xs text-slate-400">Locked ⛔</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
