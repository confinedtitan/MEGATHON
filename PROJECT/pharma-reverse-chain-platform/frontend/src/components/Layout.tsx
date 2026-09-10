import { Link, useLocation, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../auth/AuthContext";

const NAV = [
  { href: "/", label: "Overview", icon: "◈" },
  { href: "/pharmacy", label: "Pharmacy", icon: "✚", roles: ["Pharmacy", "Regulator"] },
  { href: "/distributor", label: "Distributor", icon: "▣", roles: ["Distributor", "Regulator"] },
  { href: "/manufacturer", label: "Manufacturer", icon: "⬢", roles: ["Manufacturer", "Regulator"] },
  { href: "/regulator", label: "Regulator", icon: "◎", roles: ["Regulator"] },
  { href: "/audit", label: "Audit Ledger", icon: "🔏" },
];

export function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const visible = NAV.filter((n) => !n.roles || !user || n.roles.includes(user.role) || user.role === "Regulator");

  return (
    <div className="min-h-screen bg-slate-100">
      <aside className="fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-slate-950 text-white">
        <div className="border-b border-white/10 p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-teal-400 to-emerald-600 text-xl font-bold">℞</div>
            <div>
              <p className="text-sm font-bold leading-tight">Pharma Reverse Chain</p>
              <p className="text-[11px] text-slate-400">FastAPI + React + Postgres</p>
            </div>
          </div>
          <div className="mt-3 rounded-lg bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-300 ring-1 ring-emerald-500/20">
            🔏 Hash-chained audit ledger · Ed25519 signed · No blockchain
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {visible.map((n) => {
            const active = pathname === n.href;
            return (
              <Link key={n.href} to={n.href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition ${active ? "bg-white text-slate-900 shadow" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}>
                <span className={`grid h-8 w-8 place-items-center rounded-lg text-sm font-bold ${active ? "bg-slate-900 text-white" : "bg-white/10"}`}>{n.icon}</span>
                <span className="text-sm font-semibold">{n.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-4 text-xs">
          {user ? (
            <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
              <p className="font-bold text-white">{user.name}</p>
              <p className="text-slate-400">{user.role} · {user.actor_id}</p>
              <button onClick={() => { logout(); navigate("/login"); }} className="mt-2 w-full rounded-lg bg-white/10 px-3 py-1.5 font-bold hover:bg-white/20">Logout</button>
            </div>
          ) : (
            <Link to="/login" className="block rounded-xl bg-white px-3 py-2 text-center font-bold text-slate-900">Login →</Link>
          )}
        </div>
      </aside>
      <main className="min-h-screen p-6 lg:pl-[17rem]">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
