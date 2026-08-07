import type { Request, Response, NextFunction } from "express";
import { parseCookies, type SessionPayload } from "@lynxnodes/shared";
import type { AuthService } from "../services/auth.service";

export const SESSION_COOKIE = "lynx_session";

export interface AuthedRequest extends Request {
  authUser?: SessionPayload;
}

export function createRequireAuth(authService: AuthService) {
  return function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
    const cookies = parseCookies(req.headers.cookie);
    const payload = authService.verify(cookies[SESSION_COOKIE]);
    if (!payload) {
      res.status(401).json({ error: "No autenticado" });
      return;
    }
    req.authUser = payload;
    next();
  };
}
