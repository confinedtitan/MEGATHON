import { useState } from "react";
import { useAuth } from "../auth/AuthContext";

const DEMO = [
  ["pharmacy1", "pharmacy123", "Pharmacy — CityCare"],
  ["distributor1", "distributor123", "Distributor — MediTrans"],
  ["manufacturer1", "manufacturer123", "Manufacturer — NovaGen"],
  ["regulator1", "regulator123", "Regulator — NDA"],
];

export function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState("regulator1");
  const [password, setPassword] = useState("regulator123");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(username, password);
    } catch {
      setError("Invalid credentials");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-slate-950 p-6">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-600 text-2xl font-bold text-white">℞</div>
        <h1 className="mt-4 text-2xl font-black">Pharma Reverse Chain</h1>
        <p className="text-sm text-slate-500">JWT role-based login · FastAPI backend</p>
        <form onSubmit={submit} className="mt-6 space-y-3">
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-900" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-900" />
          {error && <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
          <button disabled={busy} className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-50">
            {busy ? "Signing in…" : "Login →"}
          </button>
        </form>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {DEMO.map(([u, p, label]) => (
            <button key={u} onClick={() => { setUsername(u); setPassword(p); }} className="rounded-xl bg-slate-100 px-2 py-2 text-left text-[11px] font-semibold hover:bg-slate-200">
              {label}<br /><span className="font-mono text-slate-500">{u}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
