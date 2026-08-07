import express, { Express } from "express";
import type { CacheStrategy } from "@lynxnodes/shared";
import type { EngineConfig } from "./config/env";
import { createCache } from "./cache";
import { AssetStore } from "./storage/assetStore";
import { requestLogger } from "./middleware/logging";
import { cors } from "./middleware/cors";
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
  const cache = createCache({ maxSizeBytes: config.cacheMaxSizeBytes });
  const assetStore = new AssetStore(config.uploadsDir);
  const requireAuth = createRequireAuth(config.authSecret);

  app.use(cors);
  app.use(requestLogger);
  app.use(createHealthRouter(cache, config));
  app.use(createUploadRouter(assetStore, requireAuth));
  app.use(createProxyRouter(cache));
  // Domain router last: it's a catch-all on /:filename, so any fixed
  // route (/health, /upload, /proxy) must be declared before it.
  app.use(createAssetRouter(assetStore));

  return { app, cache, assetStore };
}
