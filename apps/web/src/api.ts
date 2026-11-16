/**
 * Client HTTP de Vigie.
 * - Le jeton d'accès (15 min) vit uniquement en mémoire : jamais dans localStorage (vol par XSS).
 * - Le refresh token est un cookie httpOnly posé par l'API : JavaScript ne peut pas le lire.
 * - Sur une réponse 401, on tente un rafraîchissement unique puis on rejoue la requête.
 */
let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;
let onSessionLost: () => void = () => {};

const WEB_HEADER = { "X-Vigie-Client": "web" };

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function setSessionLostHandler(handler: () => void) {
  onSessionLost = handler;
}

export const hasSession = () => accessToken !== null;

async function readError(res: Response): Promise<ApiError> {
  let message = `Erreur ${res.status}`;
  try {
    const body = await res.json();
    message = Array.isArray(body.message) ? body.message.join(" ; ") : (body.message ?? message);
  } catch {
    /* corps vide ou non JSON */
  }
  return new ApiError(res.status, message);
}

export async function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const res = await fetch("/api/auth/refresh", { method: "POST", headers: { ...WEB_HEADER, "Content-Type": "application/json" }, body: "{}", credentials: "same-origin" });
      if (!res.ok) {
        accessToken = null;
        return false;
      }
      accessToken = (await res.json()).accessToken;
      return true;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}

export async function login(email: string, password: string) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { ...WEB_HEADER, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    credentials: "same-origin",
  });
  if (!res.ok) throw await readError(res);
  accessToken = (await res.json()).accessToken;
}

export async function logout() {
  try {
    await api("/auth/logout", { method: "POST", body: {} });
  } finally {
    accessToken = null;
  }
}

interface Options {
  method?: string;
  body?: unknown;
  raw?: boolean;
}

export async function api<T = unknown>(path: string, opts: Options = {}, retry = true): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: opts.method ?? "GET",
    headers: {
      ...WEB_HEADER,
      ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    credentials: "same-origin",
  });
  if (res.status === 401 && retry && !path.startsWith("/auth/login")) {
    if (await refreshSession()) return api<T>(path, opts, false);
    onSessionLost();
  }
  if (!res.ok) throw await readError(res);
  if (opts.raw) return (await res.blob()) as T;
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
