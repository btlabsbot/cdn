import { Router } from "express";
import { createNodesRouter } from "./v1/nodes.routes";
import { createAuthRouter } from "./v1/auth.routes";
import { createAuthService } from "../services/auth.service";
import { createRequireAuth, createRequireNodeAuth } from "../middleware/requireAuth";
import type { GatewayConfig } from "../config/env";

export async function createApiRouter(config: GatewayConfig) {
  const authService = await createAuthService(config);
  const requireAuth = createRequireAuth(authService);
  const requireNodeAuth = createRequireNodeAuth(config.nodeAuthSecret);

  const apiRouter = Router();
  apiRouter.use("/v1/auth", createAuthRouter(authService, config));
  apiRouter.use("/v1/nodes", createNodesRouter(requireAuth, requireNodeAuth));
  return apiRouter;
}
