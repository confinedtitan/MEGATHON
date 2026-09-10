import { useEffect, useState } from "react";
import { createBatch, fetchBatches, postTransition, uploadCertificate, type Batch } from "../api/client";
import { StatusBadge } from "../components/StatusBadge";

export function Manufacturer() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const load = () => fetchBatches().then((all) => setBatches(all.filter((b) => ["RECEIVED_BY_DISTRIBUTOR", "WAITING_FOR_DESTRUCTION", "DESTROYED"].includes(b.current_status)))).catch(() => {});
  useEffect(() => { load(); }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold">Manufacturer Dashboard</h1>
      <p className="text-sm text-slate-500">Accept for destruction · certificate SHA-256 · destroy (terminal).</p>
      <div className="mt-4 rounded-2xl border bg-white p-5 shadow-sm">
        <table className="w-full min-w-[720px] text-sm">
          <thead><tr className="text-left text-[11px] uppercase text-slate-500"><th className="px-3 py-2">Batch</th><th className="px-3 py-2">Status / cert</th><th className="px-3 py-2 text-right">Actions</th></tr></thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.id} className="border-b hover:bg-slate-50">
                <td className="px-3 py-2 font-mono text-xs font-bold">{b.batch_number}<br /><span className="font-sans font-normal text-slate-500">{b.medicine_name}</span></td>
                <td className="px-3 py-2"><StatusBadge status={b.current_status} />
                  {b.certificate_hash && <p className="mt-1 font-mono text-[10px] text-emerald-700">📄 sha256:{b.certificate_hash.slice(0, 20)}…</p>}
                </td>
                <td className="px-3 py-2"><div className="flex flex-wrap justify-end gap-2">
                  {b.current_status === "RECEIVED_BY_DISTRIBUTOR" && <button onClick={() => postTransition(b.id, "destruction-ready", {}).then(load)} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white">🔥 Destruction-ready</button>}
                  {b.current_status === "WAITING_FOR_DESTRUCTION" && (<>
                    <label className="cursor-pointer rounded-lg border border-dashed border-slate-400 px-3 py-1.5 text-xs font-semibold">{file ? file.name.slice(0, 16) : "📎 Choose cert PDF"}<input type="file" accept=".pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
                    <button disabled={!file} onClick={() => file && uploadCertificate(b.id, file).then(() => { setFile(null); load(); })} className="rounded-lg border border-slate-900 px-3 py-1.5 text-xs font-bold disabled:opacity-40">Upload</button>
                    <button onClick={() => postTransition(b.id, "destroy", {}).then(load)} className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-bold text-white">⛔ Destroy</button>
                  </>)}
                  {b.current_status === "DESTROYED" && <span className="rounded-lg bg-neutral-800 px-3 py-1.5 text-xs font-bold text-white">Destroyed · terminal</span>}
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ReleaseForm onDone={load} />
    </div>
  );
}

function ReleaseForm({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({ batch_number: "", medicine_name: "", expiry_date: "", quantity: "" });
  return (
    <div className="mt-4 rounded-2xl border bg-white p-5 shadow-sm">
      <h2 className="text-sm font-bold">Release new batch (ACTIVE)</h2>
      <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
        <input value={f.batch_number} onChange={(e) => setF({ ...f, batch_number: e.target.value })} placeholder="NV-XXX-0000" className="rounded-xl border px-3 py-2 text-sm" />
        <input value={f.medicine_name} onChange={(e) => setF({ ...f, medicine_name: e.target.value })} placeholder="Medicine" className="rounded-xl border px-3 py-2 text-sm" />
        <input type="date" value={f.expiry_date} onChange={(e) => setF({ ...f, expiry_date: e.target.value })} className="rounded-xl border px-3 py-2 text-sm" />
        <input type="number" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} placeholder="Qty" className="rounded-xl border px-3 py-2 text-sm" />
      </div>
      <button onClick={() => createBatch({ batch_number: f.batch_number.toUpperCase(), medicine_name: f.medicine_name, expiry_date: f.expiry_date, quantity: Number(f.quantity) }).then(() => { setF({ batch_number: "", medicine_name: "", expiry_date: "", quantity: "" }); onDone(); })} className="mt-3 w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">+ Release batch</button>
    </div>
  );
}
