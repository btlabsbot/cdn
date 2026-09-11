import type { Request, Response, NextFunction, RequestHandler } from "express";

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
}

interface Counter {
  count: number;
  resetAt: number;
}

/**
 * Fixed-window in-memory rate limiter (single-process, alpha-grade).
 * Keyed by remote IP only (never trust X-Forwarded-For by default).
 * Cleanup runs at most once per window per key-batch to stay O(1).
 */
export function createRateLimit({ windowMs, max, message }: RateLimitOptions): RequestHandler {
  const counters = new Map<string, Counter>();
  let lastSweep = Date.now();

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const key = req.socket.remoteAddress ?? "unknown";
    const current = counters.get(key);
    const counter =
      !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;

    counter.count += 1;
    counters.set(key, counter);

    if (now - lastSweep > windowMs || counters.size > 5000) {
      lastSweep = now;
      for (const [address, entry] of counters) {
        if (entry.resetAt <= now) counters.delete(address);
      }
    }

    if (counter.count > max) {
      res.setHeader("Retry-After", Math.ceil((counter.resetAt - now) / 1000));
      res.status(429).json({ error: message ?? "Demasiados intentos; inténtalo más tarde" });
      return;
    }

    next();
  };
}
