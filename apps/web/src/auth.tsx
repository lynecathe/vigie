import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, login as apiLogin, logout as apiLogout, refreshSession, setSessionLostHandler } from "./api";
import type { Me, Role } from "./types";

interface AuthState {
  me: Me | null;
  /** true tant qu'on ne sait pas encore si une session existe (cookie de rafraîchissement). */
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  can: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSessionLostHandler(() => setMe(null));
    let cancelled = false;
    // Au chargement : si le cookie httpOnly est encore valide, on récupère une session sans redemander le mot de passe.
    refreshSession()
      .then((ok) => (ok ? api<Me>("/auth/me") : null))
      .catch(() => null)
      .then((user) => {
        if (cancelled) return;
        setMe(user);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    await apiLogin(email, password);
    setMe(await api<Me>("/auth/me"));
  }, []);

  const logout = useCallback(async () => {
    await apiLogout().catch(() => undefined);
    setMe(null);
  }, []);

  const can = useCallback((...roles: Role[]) => (me ? roles.includes(me.role) : false), [me]);

  return <AuthContext.Provider value={{ me, loading, login, logout, can }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans <AuthProvider>");
  return ctx;
}
