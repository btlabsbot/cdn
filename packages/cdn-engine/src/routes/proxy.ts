import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Router, Request, Response } from "express";
import type { CacheStrategy } from "@lynxnodes/shared";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase();
  if (isIP(normalized) === 6) {
    if (normalized.startsWith("::ffff:")) {
      return isPrivateAddress(normalized.slice("::ffff:".length));
    }
    const firstGroup = parseInt(normalized.split(":", 1)[0] || "0", 16);
    return normalized === "::" || normalized === "::1" || (firstGroup >= 0xfc00 && firstGroup <= 0xfdff) ||
      (firstGroup >= 0xfe80 && firstGroup <= 0xfebf);
  }

  const octets = normalized.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return true;
  }

  return octets[0] === 10 || octets[0] === 127 || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168) || (octets[0] === 169 && octets[1] === 254) || octets[0] === 0;
}

async function assertPublicTarget(parsed: URL): Promise<void> {
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "metadata.google.internal") {
    throw new Error("Private network targets are not allowed");
  }

  const addresses = isIP(hostname) ? [{ address: hostname }] : await lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error("Private network targets are not allowed");
  }
}

class ResponseTooLargeError extends Error {}

function cacheKeyFor(url: string): string {
  return `origin:${url}`;
}

export function createProxyRouter(cache: CacheStrategy, maxBytes: number, timeoutMs: number): Router {
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

    if (parsed.username || parsed.password) {
      res.status(400).json({ error: "URLs with credentials are not supported" });
      return;
    }

    try {
      await assertPublicTarget(parsed);
    } catch {
      res.status(400).json({ error: "Private network targets are not allowed" });
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

    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const controller = new AbortController();
      timeout = setTimeout(() => controller.abort(), timeoutMs);
      const originResponse = await fetch(targetUrl, { redirect: "manual", signal: controller.signal });

      if (!originResponse.ok) {
        res.status(originResponse.status).json({
          error: "Origin returned an error",
          status: originResponse.status,
        });
        return;
      }

      const contentType = originResponse.headers.get("content-type") ?? "application/octet-stream";
      const advertisedLength = Number(originResponse.headers.get("content-length"));
      if (Number.isFinite(advertisedLength) && advertisedLength > maxBytes) {
        res.status(413).json({ error: "Origin response exceeds the configured limit" });
        return;
      }

      if (!originResponse.body) {
        res.status(502).json({ error: "Origin returned an empty response body" });
        return;
      }

      const chunks: Buffer[] = [];
      let totalBytes = 0;
      for await (const chunk of originResponse.body) {
        const buffer = Buffer.from(chunk);
        totalBytes += buffer.length;
        if (totalBytes > maxBytes) {
          throw new ResponseTooLargeError();
        }
        chunks.push(buffer);
      }
      const value = Buffer.concat(chunks);

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
      if (err instanceof ResponseTooLargeError) {
        res.status(413).json({ error: "Origin response exceeds the configured limit" });
        return;
      }
      res.status(502).json({ error: "Failed to fetch origin" });
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  });

  return router;
}
