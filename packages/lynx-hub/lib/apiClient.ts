export type NodeStatus = "online" | "offline" | "degraded";

export interface Node {
  id: string;
  hostname: string;
  region: string;
  status: NodeStatus;
  cacheHitRate: number;
  diskUsagePct: number;
  latencyMs: number;
  lastSeen: string;
  createdAt: string;
}

/**
 * Resolves a service's base URL. If the env var isn't set, falls back to
 * the current page's protocol + hostname (not a hardcoded "localhost"),
 * so links still work when the hub is opened from another machine or a
 * remote/sandboxed environment where "localhost" doesn't resolve.
 */
function resolveBase(envValue: string | undefined, fallbackPort: number): string {
  if (envValue) return envValue.replace(/\/$/, "");
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:${fallbackPort}`;
  }
  return `http://localhost:${fallbackPort}`;
}

const API_BASE = resolveBase(process.env.NEXT_PUBLIC_API_BASE, 3000);

// cdn-engine es quien sirve los archivos subidos y el router de dominio
// (GET /:filename), por eso apunta a un puerto distinto de api-gateway.
const CDN_BASE = resolveBase(process.env.NEXT_PUBLIC_CDN_BASE, 8080);

export async function fetchNodes(): Promise<Node[]> {
  const res = await fetch(`${API_BASE}/api/v1/nodes`, { cache: "no-store", credentials: "include" });
  if (res.status === 401) {
    throw new AuthError();
  }
  if (!res.ok) {
    throw new Error(`api-gateway responded ${res.status}`);
  }
  return res.json();
}

export interface AuthUser {
  username: string;
}

/** Thrown by any API call when the session cookie is missing/expired. */
export class AuthError extends Error {
  constructor() {
    super("No autenticado");
    this.name = "AuthError";
  }
}

export interface AuthConfig {
  registrationEnabled: boolean;
}

export async function fetchAuthConfig(): Promise<AuthConfig> {
  const res = await fetch(`${API_BASE}/api/v1/auth/config`, { cache: "no-store" });
  if (!res.ok) throw new Error(`api-gateway responded ${res.status}`);
  return res.json();
}

export async function login(username: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `api-gateway responded ${res.status}`);
  }
  return res.json();
}

export async function register(username: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `api-gateway responded ${res.status}`);
  }
  return res.json();
}

export async function logout(): Promise<void> {
  await fetch(`${API_BASE}/api/v1/auth/logout`, { method: "POST", credentials: "include" });
}

export async function fetchMe(): Promise<AuthUser | null> {
  const res = await fetch(`${API_BASE}/api/v1/auth/me`, { cache: "no-store", credentials: "include" });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`api-gateway responded ${res.status}`);
  return res.json();
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/auth/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (res.status === 401) {
    // Could mean "not logged in" or "wrong current password" — the
    // gateway replies with a message either way, so surface it as a
    // normal error rather than bouncing to /login on a typo.
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "No autenticado");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `api-gateway responded ${res.status}`);
  }
}

export interface UploadedAsset {
  filename: string;
  url: string;
  contentType: string;
  size: number;
  uploadedAt: string;
}

export async function uploadFile(file: File): Promise<UploadedAsset> {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${CDN_BASE}/upload`, { method: "POST", body: form, credentials: "include" });
  if (res.status === 401) {
    throw new AuthError();
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `cdn-engine responded ${res.status}`);
  }

  const data = (await res.json()) as UploadedAsset;
  if (!data.url) {
    throw new Error("cdn-engine no devolvió una URL para el archivo subido");
  }
  // El backend devuelve una ruta relativa (/imagen.png) — se antepone el
  // origen de cdn-engine para tener el link completo y clickeable.
  return { ...data, url: `${CDN_BASE}${data.url}` };
}

export async function fetchAssets(): Promise<UploadedAsset[]> {
  const res = await fetch(`${CDN_BASE}/upload`, { cache: "no-store", credentials: "include" });
  if (res.status === 401) {
    throw new AuthError();
  }
  if (!res.ok) {
    throw new Error(`cdn-engine responded ${res.status}`);
  }
  const data = (await res.json()) as { files: UploadedAsset[] };
  return data.files
    .filter((a) => !!a.url)
    .map((a) => ({ ...a, url: `${CDN_BASE}${a.url}` }));
}

export async function deleteAsset(filename: string): Promise<void> {
  const res = await fetch(`${CDN_BASE}/upload/${encodeURIComponent(filename)}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (res.status === 401) {
    throw new AuthError();
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `cdn-engine responded ${res.status}`);
  }
}
