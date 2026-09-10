import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchStats, seedDemo } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { VerifyWidget } from "../components/VerifyWidget";

export function Overview() {
  const { user } = useAuth();
  const [stats, setStats] = useState<{ totalBatches: number; byStatus: Record<string, number>; totalAuditEvents: number; totalAlerts: number; blockedBatches: number; sellableBatches: number } | null>(null);

  useEffect(() => { fetchStats().then(setStats).catch(() => {}); }, []);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reverse Chain Command Center</h1>
          <p className="text-sm text-slate-500">Expired, returned, disputed or destroyed batches must never be sellable again.</p>
        </div>
        <button onClick={() => seedDemo().then(() => fetchStats().then(setStats))} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">↻ Load demo data</button>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          ["Total batches", stats?.totalBatches ?? "—"],
          ["Sellable", stats?.sellableBatches ?? "—"],
          ["Blocked", stats?.blockedBatches ?? "—"],
          ["Signed events", stats?.totalAuditEvents ?? "—"],
          ["Fraud alerts", stats?.totalAlerts ?? "—"],
        ].map(([l, v]) => (
          <div key={l} className="rounded-2xl border bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase text-slate-500">{l}</p>
            <p className="text-3xl font-black">{v}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold">▶ End-to-end demo (2 min)</h2>
          <ol className="mt-3 space-y-2 text-sm text-slate-700">
            {["Pharmacy: scan a batch (camera) → log return → signed event", "Distributor: schedule pickup → receive with quantity check", "Manufacturer: destruction-ready → upload certificate PDF → destroy", "POS: verify that batch → SALE BLOCKED + alert", "Regulator: integrity verification per batch + audit timeline"].map((s, i) => (
              <li key={i} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">{i + 1}. {s}</li>
            ))}
          </ol>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm font-bold">
            <Link to="/pharmacy" className="rounded-xl bg-emerald-600 px-3 py-2 text-center text-white">✚ Pharmacy</Link>
            <Link to="/distributor" className="rounded-xl bg-sky-600 px-3 py-2 text-center text-white">▣ Distributor</Link>
            <Link to="/manufacturer" className="rounded-xl bg-violet-600 px-3 py-2 text-center text-white">⬢ Manufacturer</Link>
            <Link to="/regulator" className="rounded-xl bg-amber-600 px-3 py-2 text-center text-white">◎ Regulator</Link>
          </div>
        </div>
        <VerifyWidget pharmacyName={user?.name ?? "CityCare Pharmacy"} />
      </div>
    </div>
  );
}
