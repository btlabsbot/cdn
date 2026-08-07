import type { Request, Response, NextFunction } from "express";
import { parseCookies, verifySession } from "@lynxnodes/shared";

export const SESSION_COOKIE = "lynx_session";

/**
 * cdn-engine never issues sessions itself — it only verifies the cookie
 * that api-gateway signed at login, using the same shared AUTH_SECRET.
 * Protects the file management routes (list/upload/delete); serving an
 * already-uploaded file at GET /:filename stays public on purpose, since
 * that's the whole point of a CDN link.
 */
export function createRequireAuth(authSecret: string) {
  return function requireAuth(req: Request, res: Response, next: NextFunction): void {
    const cookies = parseCookies(req.headers.cookie);
    const payload = verifySession(cookies[SESSION_COOKIE], authSecret);
    if (!payload) {
      res.status(401).json({ error: "No autenticado" });
      return;
    }
    next();
  };
}
