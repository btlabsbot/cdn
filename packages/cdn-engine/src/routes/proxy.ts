import { Router, Request, Response } from "express";
import type { CacheStrategy } from "@lynxnodes/shared";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

function cacheKeyFor(url: string): string {
  return `origin:${url}`;
}

export function createProxyRouter(cache: CacheStrategy): Router {
  const router = Router();

  router.get("/proxy", async (req: Request, res: Response) => {
    const targetUrl = req.query.url;

    if (typeof targetUrl !== "string" || targetUrl.length === 0) {
      res.status(400).json({ error: "Missing required query param: url" });
      return;
    }

    let parsed: URL;
    try {
      parsed = new URL(targetUrl);
    } catch {
      res.status(400).json({ error: "Invalid url" });
      return;
    }

    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
      res.status(400).json({ error: "Only http/https origins are supported" });
      return;
    }

    const key = cacheKeyFor(targetUrl);
    const cached = cache.get(key);

    if (cached) {
      res.setHeader("X-Cache", "HIT");
      res.setHeader("Content-Type", cached.contentType);
      res.send(cached.value);
      return;
    }

    try {
      const originResponse = await fetch(targetUrl);

      if (!originResponse.ok) {
        res.status(originResponse.status).json({
          error: "Origin returned an error",
          status: originResponse.status,
        });
        return;
      }

      const contentType = originResponse.headers.get("content-type") ?? "application/octet-stream";
      const arrayBuffer = await originResponse.arrayBuffer();
      const value = Buffer.from(arrayBuffer);

      cache.set({
        key,
        value,
        contentType,
        size: value.byteLength,
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
      });

      res.setHeader("X-Cache", "MISS");
      res.setHeader("Content-Type", contentType);
      res.send(value);
    } catch (err) {
      res.status(502).json({ error: "Failed to fetch origin", detail: (err as Error).message });
    }
  });

  return router;
}
