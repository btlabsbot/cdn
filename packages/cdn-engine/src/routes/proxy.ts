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
    // :: (unspecified), ::1 (loopback), fc00::/7 unique-local, fe80::/10 link-local
    const firstGroup = parseInt(normalized.split(":", 1)[0] || "0", 16);
    return normalized === "::" || normalized === "::1" || (firstGroup >= 0xfc00 && firstGroup <= 0xfdff) ||
      (firstGroup >= 0xfe80 && firstGroup <= 0xfebf);
  }

  const octets = normalized.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return true;
  }

  const [a, b] = octets;
  // Loopback, private RFC1918, link-local, CGNAT, benchmark/docs, multicast/reserved, unspecified
  return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 169 && b === 254) || a === 0 ||
    (a === 100 && b >= 64 && b <= 127) || // 100.64.0.0/10 CGNAT
    (a === 192 && (b === 0 || b === 2)) || // 192.0.0.0/24, 192.0.2.0/24 (incl. 192.0.0.170/170)
    (a === 198 && (b === 18 || b === 19 || b === 51)) || // benchmark + docs
    (a === 203 && b === 0 && octets[2] === 113) || // 203.0.113.0/24 docs
    a >= 224; // 224.0.0.0/4 multicast + 240.0.0.0/4 reserved
}

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.google.internal.",
  "169.254.169.254",
  "metadata",
]);

function isBlockedHostname(hostname: string): boolean {
  // Strip trailing dot (DNS FQDN form: "metadata.google.internal." === blocked)
  const h = hostname.toLowerCase().replace(/\.+$/, "");
  if (BLOCKED_HOSTNAMES.has(h) || h === "metadata") return true;
  if (h.endsWith(".localhost") || h.endsWith(".internal") || h.endsWith(".local")) return true;
  if (h === "localhost") return true;
  return false;
}

async function assertPublicTarget(parsed: URL): Promise<void> {
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (isBlockedHostname(hostname)) {
    throw new Error("Private network targets are not allowed");
  }

  const addresses = isIP(hostname) ? [{ address: hostname }] : await lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error("Private network targets are not allowed");
  }
  // NOTE (TOCTOU): fetch() re-resolves DNS, so a rotating/DNS-rebinding name
  // could resolve public here and private at fetch time. Full fix needs IP
  // pinning (dial pinned IP with Host/SNI preserved). Mitigations in place:
  // manual redirects (never auto-followed), timeout, size cap, and post-fetch
  // re-resolution check below narrows but does not close the window.
}

async function assertStillPublic(hostname: string): Promise<void> {
  try {
    const clean = hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (isBlockedHostname(clean)) throw new Error("blocked");
    if (isIP(clean)) {
      if (isPrivateAddress(clean)) throw new Error("private");
      return;
    }
    const addresses = await lookup(clean, { all: true, verbatim: true });
    if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
      throw new Error("Private network targets are not allowed");
    }
  } catch (err) {
    throw new Error("Private network targets are not allowed");
  }
}

class ResponseTooLargeError extends Error {}

const MAX_URL_LENGTH = 2048;

/** Normalizes the cache key so ?b=2&a=1 and ?a=1&b=2 don't duplicate entries. */
function cacheKeyFor(rawUrl: string, parsed: URL): string {
  try {
    const u = new URL(parsed.toString());
    u.searchParams.sort();
    return `origin:${u.toString()}`;
  } catch {
    return `origin:${rawUrl}`;
  }
}

/** Content types that can execute script in a browser: force download, never inline. */
function isExecutableContentType(contentType: string): boolean {
  const base = contentType.split(";", 1)[0].trim().toLowerCase();
  return base === "text/html" || base === "application/xhtml+xml" || base === "image/svg+xml" ||
    base === "text/svg+xml" || base === "application/xml" || base === "text/xml" ||
    base.startsWith("text/html");
}

function setProxySecurityHeaders(res: Response, contentType: string): void {
  res.setHeader("Content-Type", contentType);
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (isExecutableContentType(contentType)) {
    res.setHeader("Content-Disposition", "attachment");
  }
}

export function createProxyRouter(cache: CacheStrategy, maxBytes: number, timeoutMs: number): Router {
  const router = Router();

  router.get("/proxy", async (req: Request, res: Response) => {
    const targetUrl = req.query.url;

    if (typeof targetUrl !== "string" || targetUrl.length === 0) {
      res.status(400).json({ error: "Missing required query param: url" });
      return;
    }

    if (targetUrl.length > MAX_URL_LENGTH) {
      res.status(400).json({ error: "URL exceeds maximum length" });
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

    const key = cacheKeyFor(targetUrl, parsed);
    const cached = cache.get(key);

    if (cached) {
      res.setHeader("X-Cache", "HIT");
      setProxySecurityHeaders(res, cached.contentType);
      res.send(cached.value);
      return;
    }

    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const controller = new AbortController();
      timeout = setTimeout(() => controller.abort(), timeoutMs);
      // Redirects are never auto-followed: a 3xx to an internal target must not be fetched.
      const originResponse = await fetch(parsed.toString(), { redirect: "manual", signal: controller.signal });

      // Narrow the DNS-rebinding window: re-resolve after fetch, abort serving if now private.
      try {
        await assertStillPublic(parsed.hostname);
      } catch {
        res.status(400).json({ error: "Private network targets are not allowed" });
        return;
      }

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
      setProxySecurityHeaders(res, contentType);
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
