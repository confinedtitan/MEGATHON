"use client";
import { useCallback, useEffect, useState } from "react";
import { Batch, fetchBatches, postTransition } from "@/lib/client";
import { ActorSelect, Card, Empty, PageHeader, Shell, StatusBadge, Toast } from "@/components/ui";
import { BatchDetail, VerifyWidget } from "@/components/widgets";

const PHARMACIES = ["CityCare Pharmacy", "GreenCross Pharmacy"];
const ALL_STATUSES = ["ACTIVE", "LOGGED_FOR_RETURN", "PICKUP_SCHEDULED", "RECEIVED_BY_DISTRIBUTOR", "DISPUTED", "WAITING_FOR_DESTRUCTION", "DESTROYED"];

export default function PharmacyPage() {
  const [actor, setActor] = useState(PHARMACIES[0]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Batch | null>(null);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" | "info" } | null>(null);
  const [reason, setReason] = useState("Expired stock — return to distributor");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setBatches(await fetchBatches(status || undefined, search || undefined));
    } catch {
      setToast({ msg: "Failed to load batches. Load demo data from Overview.", kind: "err" });
    } finally {
      setLoading(false);
    }
  }, [status, search]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  async function requestReturn(b: Batch) {
    setBusyId(b.id);
    try {
      await postTransition(b.id, "return", {
        actor_name: actor,
        actor_role: "Pharmacy",
        remarks: reason,
      });
      setToast({ msg: `${b.batchNumber}: ACTIVE → LOGGED_FOR_RETURN ✓ signed event appended`, kind: "ok" });
      await load();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        "Transition rejected";
      setToast({ msg: `${b.batchNumber}: ${msg}`, kind: "err" });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Shell>
      <PageHeader
        title="Pharmacy Dashboard"
        subtitle="View stock · scan a batch · log returns · verify every sale."
        right={
          <div className="w-56">
            <ActorSelect label="Acting as" value={actor} onChange={setActor} options={PHARMACIES} />
          </div>
        }
      />

      <VerifyWidget defaultPharmacy={actor} />

      <div className="mt-6">
        <Card
          title="Medicine batches"
          subtitle="Only ACTIVE batches can be logged for return. Everything else is locked in the reverse chain."
          action={
            <div className="flex gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search batch / medicine…"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
              />
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium outline-none"
              >
                <option value="">All statuses</option>
                {ALL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          }
        >
          <label className="mb-3 block max-w-md">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Default return reason
            </span>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </label>
          {loading ? (
            <p className="py-8 text-center text-sm text-slate-500">Loading batches…</p>
          ) : batches.length === 0 ? (
            <Empty text="No batches found. Load demo data from the Overview page." />
          ) : (
            <div className="slim-scroll overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="border-b px-3 py-2">Batch</th>
                    <th className="border-b px-3 py-2">Medicine</th>
                    <th className="border-b px-3 py-2">Expiry</th>
                    <th className="border-b px-3 py-2">Qty</th>
                    <th className="border-b px-3 py-2">Status</th>
                    <th className="border-b px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((b) => (
                    <tr key={b.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-3 py-2.5 font-mono text-xs font-bold">{b.batchNumber}</td>
                      <td className="px-3 py-2.5">{b.medicineName}</td>
                      <td className="px-3 py-2.5 text-slate-600">{b.expiryDate}</td>
                      <td className="px-3 py-2.5">{b.quantity.toLocaleString()}</td>
                      <td className="px-3 py-2.5">
                        <StatusBadge status={b.currentStatus} />
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setDetail(b)}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-100"
                          >
                            View
                          </button>
                          {b.currentStatus === "ACTIVE" ? (
                            <button
                              onClick={() => requestReturn(b)}
                              disabled={busyId === b.id}
                              className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-orange-500 disabled:opacity-50"
                            >
                              {busyId === b.id ? "…" : "↩ Log return"}
                            </button>
                          ) : (
                            <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-400">
                              Locked ⛔
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {detail && <BatchDetail batch={detail} onClose={() => setDetail(null)} />}
      {toast && <Toast msg={toast.msg} kind={toast.kind} />}
    </Shell>
  );
}
