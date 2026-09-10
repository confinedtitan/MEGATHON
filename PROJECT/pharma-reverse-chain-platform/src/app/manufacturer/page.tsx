"use client";
import { useCallback, useEffect, useState } from "react";
import { Batch, fetchBatches, postTransition, uploadCertificate, createBatch } from "@/lib/client";
import { Card, Empty, PageHeader, Shell, StatusBadge, Toast } from "@/components/ui";
import { BatchDetail } from "@/components/widgets";

export default function ManufacturerPage() {
  const actor = "NovaGen Labs";
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Batch | null>(null);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" | "info" } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [newBatch, setNewBatch] = useState({
    batch_number: "",
    medicine_name: "",
    expiry_date: "",
    quantity: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await fetchBatches();
      setBatches(
        all.filter((b) =>
          ["RECEIVED_BY_DISTRIBUTOR", "WAITING_FOR_DESTRUCTION", "DESTROYED"].includes(
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

  async function act(b: Batch, action: string, body: Record<string, unknown>, okMsg: string) {
    setBusyId(b.id);
    try {
      await postTransition(b.id, action, {
        actor_name: actor,
        actor_role: "Manufacturer",
        ...body,
      });
      setToast({ msg: `${b.batchNumber}: ${okMsg}`, kind: "ok" });
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

  async function upload(b: Batch) {
    if (!file) {
      setToast({ msg: "Choose a PDF certificate first", kind: "err" });
      return;
    }
    setBusyId(b.id);
    try {
      const r = await uploadCertificate(b.id, file);
      setToast({ msg: `Certificate stored · sha256 ${String(r.certificate_hash).slice(0, 16)}…`, kind: "ok" });
      setFile(null);
      await load();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Upload failed";
      setToast({ msg, kind: "err" });
    } finally {
      setBusyId(null);
    }
  }

  async function create() {
    if (!newBatch.batch_number || !newBatch.medicine_name || !newBatch.expiry_date || !newBatch.quantity) {
      setToast({ msg: "Fill all new-batch fields", kind: "err" });
      return;
    }
    try {
      await createBatch({
        batch_number: newBatch.batch_number.toUpperCase(),
        medicine_name: newBatch.medicine_name,
        manufacturer_name: actor,
        expiry_date: newBatch.expiry_date,
        quantity: Number(newBatch.quantity),
        actor_name: actor,
        actor_role: "Manufacturer",
      });
      setToast({ msg: `${newBatch.batch_number.toUpperCase()} created as ACTIVE — signed BATCH_CREATED event`, kind: "ok" });
      setNewBatch({ batch_number: "", medicine_name: "", expiry_date: "", quantity: "" });
      await load();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Create failed";
      setToast({ msg, kind: "err" });
    }
  }

  const section = (s: string) => batches.filter((b) => b.currentStatus === s);

  function Row({ b }: { b: Batch }) {
    const busy = busyId === b.id;
    return (
      <tr className="border-b border-slate-50 hover:bg-slate-50">
        <td className="px-3 py-2.5 font-mono text-xs font-bold">{b.batchNumber}</td>
        <td className="px-3 py-2.5">{b.medicineName}</td>
        <td className="px-3 py-2.5">{b.quantity.toLocaleString()}</td>
        <td className="px-3 py-2.5">
          <StatusBadge status={b.currentStatus} />
          {b.certificateHash ? (
            <p className="mt-1 max-w-[220px] truncate font-mono text-[10px] text-emerald-700" title={b.certificateHash}>
              📄 sha256:{b.certificateHash.slice(0, 20)}…
            </p>
          ) : (
            b.currentStatus === "WAITING_FOR_DESTRUCTION" && (
              <p className="mt-1 text-[11px] text-amber-700">No certificate yet</p>
            )
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
            {b.currentStatus === "RECEIVED_BY_DISTRIBUTOR" && (
              <button
                disabled={busy}
                onClick={() =>
                  act(b, "destruction-ready", { remarks: "Accepted for certified destruction" }, "→ WAITING_FOR_DESTRUCTION ✓ signed event appended")
                }
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-500 disabled:opacity-50"
              >
                {busy ? "…" : "🔥 Mark destruction-ready"}
              </button>
            )}
            {b.currentStatus === "WAITING_FOR_DESTRUCTION" && (
              <>
                <label className="cursor-pointer rounded-lg border border-dashed border-slate-400 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                  {file ? `📄 ${file.name.slice(0, 18)}…` : "📎 Choose cert PDF"}
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                <button
                  disabled={busy || !file}
                  onClick={() => upload(b)}
                  className="rounded-lg border border-slate-900 px-3 py-1.5 text-xs font-bold text-slate-900 hover:bg-slate-900 hover:text-white disabled:opacity-40"
                >
                  Upload cert
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    act(b, "destroy", { remarks: "Destroyed under supervision. Certificate issued." }, "→ DESTROYED ✓ signed DESTRUCTION_VERIFIED event · terminal")
                  }
                  className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-neutral-700 disabled:opacity-50"
                >
                  {busy ? "…" : "⛔ Destroy"}
                </button>
              </>
            )}
            {b.currentStatus === "DESTROYED" && (
              <span className="rounded-lg bg-neutral-800 px-3 py-1.5 text-xs font-bold text-white">
                Destroyed · terminal
              </span>
            )}
          </div>
        </td>
      </tr>
    );
  }

  function Table({ title, sub, rows }: { title: string; sub: string; rows: Batch[] }) {
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
          <table className="w-full min-w-[760px] bg-white text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Batch</th>
                <th className="px-3 py-2">Medicine</th>
                <th className="px-3 py-2">Qty</th>
                <th className="px-3 py-2">Status / cert</th>
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
        title="Manufacturer Dashboard"
        subtitle={`Acting as ${actor} · accept for destruction · certify · destroy.`}
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="Destruction protocol" subtitle="Certificate → hash → signed destruction event">
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-slate-600">
            <li>Move received batches to waiting-for-destruction.</li>
            <li>Upload the signed destruction certificate PDF — the server stores it locally and computes its SHA-256 hash.</li>
            <li>Destroy the batch. The certificate hash is embedded in the signed <span className="font-mono text-xs font-bold">DESTRUCTION_VERIFIED</span> audit event.</li>
            <li>Destroyed is terminal: no transition out is possible, and POS always blocks it.</li>
          </ol>
        </Card>
        <Card title="Release new batch" subtitle="POST /batch — enters the chain as ACTIVE">
          <div className="grid grid-cols-2 gap-2">
            <input value={newBatch.batch_number} onChange={(e) => setNewBatch({ ...newBatch, batch_number: e.target.value })} placeholder="Batch no. NV-XXX-0000" className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900" />
            <input value={newBatch.medicine_name} onChange={(e) => setNewBatch({ ...newBatch, medicine_name: e.target.value })} placeholder="Medicine name" className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900" />
            <input type="date" value={newBatch.expiry_date} onChange={(e) => setNewBatch({ ...newBatch, expiry_date: e.target.value })} className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900" />
            <input type="number" min={1} value={newBatch.quantity} onChange={(e) => setNewBatch({ ...newBatch, quantity: e.target.value })} placeholder="Quantity" className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900" />
          </div>
          <button onClick={create} className="mt-3 w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700">
            + Release batch as ACTIVE
          </button>
        </Card>
      </div>

      <div className="mt-6">
        <Card title="Destruction pipeline" subtitle="Received → waiting → destroyed">
          {loading ? (
            <p className="py-8 text-center text-sm text-slate-500">Loading pipeline…</p>
          ) : batches.length === 0 ? (
            <Empty text="Nothing here yet. Distributors must receive batches first." />
          ) : (
            <>
              <Table title="Received from distributors" sub="RECEIVED_BY_DISTRIBUTOR → mark destruction-ready" rows={section("RECEIVED_BY_DISTRIBUTOR")} />
              <Table title="Waiting for destruction" sub="Upload certificate, then destroy" rows={section("WAITING_FOR_DESTRUCTION")} />
              <Table title="Destroyed" sub="Terminal — permanently blocked from sale" rows={section("DESTROYED")} />
            </>
          )}
        </Card>
      </div>

      {detail && <BatchDetail batch={detail} onClose={() => setDetail(null)} />}
      {toast && <Toast msg={toast.msg} kind={toast.kind} />}
    </Shell>
  );
}
