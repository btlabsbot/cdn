import type { Request, Response, NextFunction } from "express";
import { parseCookies, verifySession, type SessionPayload } from "@lynxnodes/shared";

export const SESSION_COOKIE = "lynx_session";

export interface AuthedRequest extends Request {
  authUser?: SessionPayload;
}

export interface EngineAuthOptions {
  gatewayUrl: string | null;
  nodeAuthSecret: string;
  /** Cache window for positive gateway checks (revocation granularity). Default 60s. */
  checkCacheTtlMs?: number;
}

interface CacheEntry {
  valid: boolean;
  ver: number;
  expiresAt: number;
}

/**
 * Verifies the signed cookie locally, then confirms `ver` (revocation) with
 * the gateway via POST /api/v1/auth/check (X-Node-Auth). Positive results are
 * cached ~60s so every upload/list/delete doesn't add gateway latency.
 * If the gateway is unreachable: allow on fresh cache, else 503 (fail closed
 * without cache, fail-open-with-cache for availability).
 */
export function createRequireAuth(authSecret: string, opts?: EngineAuthOptions) {
  const cache = new Map<string, CacheEntry>();
  const ttlMs = opts?.checkCacheTtlMs ?? 60_000;

  async function checkWithGateway(token: string): Promise<CacheEntry | null> {
    if (!opts?.gatewayUrl) return null;
    const cached = cache.get(token);
    if (cached && cached.expiresAt > Date.now()) return cached;
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 5000);
      try {
        const res = await fetch(`${opts.gatewayUrl}/api/v1/auth/check`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Node-Auth": opts.nodeAuthSecret },
          body: JSON.stringify({ token }),
          signal: controller.signal,
        });
        if (res.status === 401) {
          const entry: CacheEntry = { valid: false, ver: -1, expiresAt: Date.now() + 10_000 };
          cache.set(token, entry);
          return entry;
        }
        if (!res.ok) return cached ?? null;
        const body = (await res.json()) as { valid: boolean; ver?: number };
        const entry: CacheEntry = {
          valid: body.valid === true,
          ver: typeof body.ver === "number" ? body.ver : 0,
          expiresAt: Date.now() + (body.valid === true ? ttlMs : 10_000),
        };
        cache.set(token, entry);
        if (cache.size > 1000) {
          const first = cache.keys().next().value;
          if (first) cache.delete(first);
        }
        return entry;
      } finally {
        clearTimeout(t);
      }
    } catch {
      return cached ?? null;
    }
  }

  return function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies[SESSION_COOKIE];
    const payload = verifySession(token, authSecret);
    if (!payload || !token) {
      res.status(401).json({ error: "No autenticado" });
      return;
    }

    // Standalone (no gateway): local verification only (can't check revocation).
    if (!opts?.gatewayUrl) {
      req.authUser = payload;
      next();
      return;
    }

    checkWithGateway(token)
      .then((entry) => {
        if (!entry) {
          res.status(503).json({ error: "Auth service unavailable, retry later" });
          return;
        }
        if (!entry.valid) {
          res.status(401).json({ error: "No autenticado" });
          return;
        }
        req.authUser = payload;
        next();
      })
      .catch(() => {
        res.status(503).json({ error: "Auth service unavailable, retry later" });
      });
  };
}
