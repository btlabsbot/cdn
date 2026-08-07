import { Router } from "express";
import { createNodesRouter } from "./v1/nodes.routes";
import { createAuthRouter } from "./v1/auth.routes";
import { createAuthService } from "../services/auth.service";
import { createRequireAuth } from "../middleware/requireAuth";
import { loadConfig } from "../config/env";

export const apiRouter = Router();

const config = loadConfig();
const authService = createAuthService(config);
const requireAuth = createRequireAuth(authService);

apiRouter.use("/v1/auth", createAuthRouter(authService));
apiRouter.use("/v1/nodes", createNodesRouter(requireAuth));
