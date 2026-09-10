import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { api, login as apiLogin } from "../api/client";

export interface SessionUser {
  username: string;
  role: "Pharmacy" | "Distributor" | "Manufacturer" | "Regulator" | string;
  actor_id: string;
  name: string;
}

interface AuthCtx {
  user: SessionUser | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>({ user: null, token: null, login: async () => {}, logout: () => {} });

export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const t = localStorage.getItem("pharma_token");
    const u = localStorage.getItem("pharma_user");
    if (t && u) {
      setToken(t);
      try {
        setUser(JSON.parse(u));
      } catch {
        /* ignore */
      }
      api.get("/auth/me").catch(() => {
        localStorage.removeItem("pharma_token");
        localStorage.removeItem("pharma_user");
        setToken(null);
        setUser(null);
      });
    }
  }, []);

  async function login(username: string, password: string) {
    const data = await apiLogin(username, password);
    localStorage.setItem("pharma_token", data.access_token);
    localStorage.setItem("pharma_user", JSON.stringify(data.user));
    setToken(data.access_token);
    setUser(data.user);
    const role = data.user.role;
    navigate(role === "Pharmacy" ? "/pharmacy" : role === "Distributor" ? "/distributor" : role === "Manufacturer" ? "/manufacturer" : "/regulator", { replace: true });
  }

  function logout() {
    localStorage.removeItem("pharma_token");
    localStorage.removeItem("pharma_user");
    setToken(null);
    setUser(null);
    navigate("/login", { replace: true });
  }

  return <Ctx.Provider value={{ user, token, login, logout }}>{children}</Ctx.Provider>;
}
