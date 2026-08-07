import type { Request, Response, NextFunction } from "express";
import { parseCookies, verifySession } from "@lynxnodes/shared";

export const SESSION_COOKIE = "lynx_session";

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
