"use client";
import { useCallback, useEffect, useState } from "react";
import { Batch, fetchBatches, postTransition } from "@/lib/client";
import { ActorSelect, Card, Empty, PageHeader, Shell, StatusBadge, Toast } from "@/components/ui";
import { BatchDetail } from "@/components/widgets";

const DISTRIBUTORS = ["MediTrans Logistics", "SwiftPharma Distributors"];

export default function DistributorPage() {
  const [actor, setActor] = useState(DISTRIBUTORS[0]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Batch | null>(null);
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [disputeReason, setDisputeReason] = useState("Damaged packaging found during inspection");
  const [resolution, setResolution] = useState("Recount confirmed full quantity — dispute closed");
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" | "info" } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await fetchBatches();
      setBatches(
        all.filter((b) =>
          ["LOGGED_FOR_RETURN", "PICKUP_SCHEDULED", "RECEIVED_BY_DISTRIBUTOR", "DISPUTED"].includes(
            b.currentStatus
          )
        )
      );
    } catch {
      setToast({ msg: "Failed to load. Load demo data from Overview.", kind: "err" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  async function act(
    b: Batch,
    action: string,
    body: Record<string, unknown>,
    okMsg: string
  ) {
    setBusyId(b.id);
    try {
      const r = await postTransition(b.id, action, {
        actor_name: actor,
        actor_role: "Distributor",
        ...body,
      });
      if (r.disputed) {
        setToast({ msg: `${b.batchNumber}: quantity mismatch → DISPUTED ⚠ signed QUANTITY_DISCREPANCY event`, kind: "info" });
      } else {
        setToast({ msg: `${b.batchNumber}: ${okMsg}`, kind: "ok" });
      }
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

  const queue = (s: string) => batches.filter((b) => b.currentStatus === s);

  function Row({ b }: { b: Batch }) {
    const busy = busyId === b.id;
    return (
      <tr className="border-b border-slate-50 hover:bg-slate-50">
        <td className="px-3 py-2.5 font-mono text-xs font-bold">{b.batchNumber}</td>
        <td className="px-3 py-2.5">{b.medicineName}</td>
        <td className="px-3 py-2.5">{b.quantity.toLocaleString()}</td>
        <td className="px-3 py-2.5">
          <StatusBadge status={b.currentStatus} />
          {b.discrepancyReason && (
            <p className="mt-1 max-w-[220px] text-[11px] text-red-700">{b.discrepancyReason}</p>
          )}
        </td>
        <td className="px-3 py-2.5">
          <div className="flex flex-wrap justify-end gap-2">
            <button
              onClick={() => setDetail(b)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-100"
            >
              View
            </button>
            {b.currentStatus === "LOGGED_FOR_RETURN" && (
              <button
                disabled={busy}
                onClick={() =>
                  act(b, "schedule-pickup", { remarks: `Pickup scheduled at pharmacy by ${actor}` }, "pickup scheduled ✓ signed event appended")
                }
                className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-500 disabled:opacity-50"
              >
                {busy ? "…" : "🚚 Schedule pickup"}
              </button>
            )}
            {b.currentStatus === "PICKUP_SCHEDULED" && (
              <>
                <input
                  value={counts[b.id] ?? ""}
                  onChange={(e) =>
                    setCounts((c) => ({ ...c, [b.id]: e.target.value }))
                  }
                  placeholder={`Count (declared ${b.quantity})`}
                  inputMode="numeric"
                  className="w-44 rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-slate-900"
                />
                <button
                  disabled={busy}
                  onClick={() =>
                    act(
                      b,
                      "receive",
                      counts[b.id]
                        ? { received_quantity: Number(counts[b.id]) }
                        : { remarks: "Received — quantity verified OK" },
                      "received ✓ signed event appended"
                    )
                  }
                  className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-500 disabled:opacity-50"
                >
                  {busy ? "…" : "📦 Receive"}
                </button>
              </>
            )}
            {(b.currentStatus === "PICKUP_SCHEDULED" ||
              b.currentStatus === "RECEIVED_BY_DISTRIBUTOR") && (
              <button
                disabled={busy}
                onClick={() => act(b, "raise-dispute", { reason: disputeReason }, "moved to DISPUTED — signed event appended")}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-500 disabled:opacity-50"
              >
                {busy ? "…" : "⚠ Dispute"}
              </button>
            )}
            {b.currentStatus === "DISPUTED" && (
              <button
                disabled={busy}
                onClick={() =>
                  act(b, "resolve-dispute", { resolution }, "dispute resolved → RECEIVED ✓ reconciliation event appended")
                }
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {busy ? "…" : "✓ Resolve dispute"}
              </button>
            )}
          </div>
        </td>
      </tr>
    );
  }

  function QueueTable({ title, sub, rows }: { title: string; sub: string; rows: Batch[] }) {
    if (rows.length === 0) return null;
    return (
      <div className="mt-6 first:mt-0">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            <p className="text-xs text-slate-500">{sub}</p>
          </div>
          <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-white">
            {rows.length}
          </span>
        </div>
        <div className="slim-scroll overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[720px] bg-white text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Batch</th>
                <th className="px-3 py-2">Medicine</th>
                <th className="px-3 py-2">Declared</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <Row key={b.id} b={b} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <Shell>
      <PageHeader
        title="Distributor Dashboard"
        subtitle="Return queue · pickup scheduling · receipt with quantity verification · disputes."
        right={
          <div className="w-60">
            <ActorSelect label="Acting as" value={actor} onChange={setActor} options={DISTRIBUTORS} />
          </div>
        }
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="Quantity verification rule" subtitle="Applied on every receipt">
          <p className="text-sm text-slate-600">
            Enter the physically counted quantity before clicking <b>Receive</b>. If the count differs
            from the declared quantity, the batch is automatically moved to{" "}
            <StatusBadge status="DISPUTED" /> and a signed{" "}
            <span className="font-mono text-xs font-bold">QUANTITY_DISCREPANCY</span> audit event
            records expected vs received vs difference. The discrepancy can never be overwritten —
            only reconciled with a new signed event.
          </p>
        </Card>
        <Card title="Dispute texts" subtitle="Used by the Dispute / Resolve buttons below">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                Dispute reason
              </span>
              <input
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                Resolution note
              </span>
              <input
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
              />
            </label>
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <Card title="Work queue" subtitle="Batches currently in the distributor pipeline">
          {loading ? (
            <p className="py-8 text-center text-sm text-slate-500">Loading queue…</p>
          ) : batches.length === 0 ? (
            <Empty text="Queue is empty. Log a return from the Pharmacy dashboard first." />
          ) : (
            <>
              <QueueTable
                title="Logged returns"
                sub="LOGGED_FOR_RETURN → schedule a pickup"
                rows={queue("LOGGED_FOR_RETURN")}
              />
              <QueueTable
                title="Pickups scheduled"
                sub="PICKUP_SCHEDULED → receive & verify quantity"
                rows={queue("PICKUP_SCHEDULED")}
              />
              <QueueTable
                title="Disputed"
                sub="DISPUTED → resolve back to received"
                rows={queue("DISPUTED")}
              />
              <QueueTable
                title="Received"
                sub="RECEIVED_BY_DISTRIBUTOR → handed to manufacturer next"
                rows={queue("RECEIVED_BY_DISTRIBUTOR")}
              />
            </>
          )}
        </Card>
      </div>

      {detail && <BatchDetail batch={detail} onClose={() => setDetail(null)} />}
      {toast && <Toast msg={toast.msg} kind={toast.kind} />}
    </Shell>
  );
}
