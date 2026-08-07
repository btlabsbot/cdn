import type { Request, Response, NextFunction } from "express";

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    const cacheHeader = res.getHeader("X-Cache") ?? "-";
    console.log(`[cdn-engine] ${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms cache=${cacheHeader}`);
  });
  next();
}
