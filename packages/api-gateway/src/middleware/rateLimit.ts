import type { Request, Response, NextFunction, RequestHandler } from "express";

interface RateLimitOptions {
  windowMs: number;
  max: number;
}

interface Counter {
  count: number;
  resetAt: number;
}

export function createRateLimit({ windowMs, max }: RateLimitOptions): RequestHandler {
  const counters = new Map<string, Counter>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const key = req.socket.remoteAddress ?? "unknown";
    const current = counters.get(key);
    const counter = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : current;

    counter.count += 1;
    counters.set(key, counter);

    for (const [address, entry] of counters) {
      if (entry.resetAt <= now) counters.delete(address);
    }

    if (counter.count > max) {
      res.setHeader("Retry-After", Math.ceil((counter.resetAt - now) / 1000));
      res.status(429).json({ error: "Demasiados intentos; inténtalo más tarde" });
      return;
    }

    next();
  };
}