import express, { Express, Request, Response, NextFunction } from "express";
import type { CacheStrategy } from "@lynxnodes/shared";
import type { EngineConfig } from "./config/env";
import { createCache } from "./cache";
import { AssetStore } from "./storage/assetStore";
import { requestLogger } from "./middleware/logging";
import { cors } from "./middleware/cors";
import { securityHeaders } from "./middleware/security";
import { createRateLimit } from "./middleware/rateLimit";
import { createRequireAuth } from "./middleware/requireAuth";
import { createProxyRouter } from "./routes/proxy";
import { createHealthRouter } from "./routes/health";
import { createUploadRouter } from "./routes/upload";
import { createAssetRouter } from "./routes/assets";

export interface ServerInstance {
  app: Express;
  cache: CacheStrategy;
  assetStore: AssetStore;
}

export function createServer(config: EngineConfig): ServerInstance {
  const app = express();
  app.disable("x-powered-by");
  const cache = createCache({ maxSizeBytes: config.cacheMaxSizeBytes });
  const assetStore = new AssetStore(config.uploadsDir);
  const requireAuth = createRequireAuth(config.authSecret, {
    gatewayUrl: config.gatewayUrl,
    nodeAuthSecret: config.nodeAuthSecret,
  });

  const proxyRateLimit = createRateLimit({ windowMs: 60_000, max: 60, message: "Too many proxy requests" });
  const uploadRateLimit = createRateLimit({ windowMs: 60_000, max: 20, message: "Too many uploads" });

  app.use((req, res, next) => cors(req, res, next, config.corsOrigins));
  app.use(securityHeaders);
  app.use(requestLogger);
  app.use(createHealthRouter(cache, config));
  // Authenticated upload/list/delete (rate-limited; spool-to-disk, MIME-sniffed).
  app.use((req, res, next) => {
    if (req.path === "/upload" || req.path.startsWith("/upload/")) return uploadRateLimit(req, res, next);
    next();
  });
  app.use(createUploadRouter(assetStore, requireAuth, config.uploadsDir));
  // Public open-relay with cache: rate-limited.
  app.use((req, res, next) => {
    if (req.path === "/proxy") return proxyRateLimit(req, res, next);
    next();
  });
  app.use(createProxyRouter(cache, config.proxyMaxBytes, config.proxyTimeoutMs));
  app.use(createAssetRouter(assetStore));

  // JSON 404 (asset router only handles single-segment names)
  app.use((req: Request, res: Response) => {
    res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
  });
  // JSON error handler (multer/CorruptStore/mime failures must not crash or leak HTML)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof SyntaxError && "body" in err) {
      res.status(400).json({ error: "Invalid JSON body" });
      return;
    }
    console.error("[cdn-engine] unhandled error:", err);
    if (res.headersSent) return;
    res.status(500).json({ error: "Internal server error" });
  });

  return { app, cache, assetStore };
}
