import { Router, Request, Response } from "express";
import type { CacheStrategy } from "@lynxnodes/shared";
import type { EngineConfig } from "../config/env";

export function createHealthRouter(cache: CacheStrategy, config: EngineConfig): Router {
  const router = Router();

  router.get("/health", (_req: Request, res: Response) => {
    const stats = cache.stats();
    res.json({
      status: "ok",
      nodeId: config.nodeId,
      region: config.region,
      uptimeSeconds: Math.floor(process.uptime()),
      cache: stats,
    });
  });

  return router;
}
