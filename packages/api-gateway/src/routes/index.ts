import { Router } from "express";
import { createNodesRouter } from "./v1/nodes.routes";
import { createAuthRouter } from "./v1/auth.routes";
import { createAuthService } from "../services/auth.service";
import { createRequireAuth, createRequireNodeAuth } from "../middleware/requireAuth";
import { loadConfig } from "../config/env";

export const apiRouter = Router();

const config = loadConfig();
const authService = createAuthService(config);
const requireAuth = createRequireAuth(authService);
const requireNodeAuth = createRequireNodeAuth(config.nodeAuthSecret);

apiRouter.use("/v1/auth", createAuthRouter(authService));
apiRouter.use("/v1/nodes", createNodesRouter(requireAuth, requireNodeAuth));
