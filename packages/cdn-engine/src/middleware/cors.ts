import type { Request, Response, NextFunction } from "express";

/**
 * Without this, any fetch() from lynx-hub (port 3001) to cdn-engine
 * (port 8080) gets blocked by the browser with "NetworkError" BEFORE the
 * request even reaches the server — different origins. api-gateway already
 * had this same middleware; cdn-engine needs it too now that lynx-hub
 * talks to it directly (file uploads, domain router).
 *
 * The origin is reflected (not "*") and Allow-Credentials is set so the
 * shared login cookie (issued by api-gateway) is actually sent/accepted
 * on requests to cdn-engine's protected upload/delete routes.
 */
export function cors(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
}
