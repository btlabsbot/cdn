import { Router, type RequestHandler } from "express";
import type { GatewayConfig } from "../../config/env";
import type { AuthService } from "../../services/auth.service";
import { createAuthController } from "../../controllers/auth.controller";
import { createRequireAuth, createRequireNodeAuth } from "../../middleware/requireAuth";
import { createRateLimit } from "../../middleware/rateLimit";

function asyncHandler(fn: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function createAuthRouter(authService: AuthService, config: GatewayConfig): Router {
  const router = Router();
  const controller = createAuthController(authService, config);
  const requireAuth = createRequireAuth(authService);
  const requireNodeAuth = createRequireNodeAuth(config.nodeAuthSecret);
  const authRateLimit = createRateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
  const registrationRateLimit = createRateLimit({ windowMs: 60 * 60 * 1000, max: 5 });

  router.get("/config", controller.config);
  router.post("/login", authRateLimit, asyncHandler(controller.login));
  router.post("/register", registrationRateLimit, asyncHandler(controller.register));
  router.post("/logout", controller.logout);
  router.get("/me", requireAuth, controller.me);
  router.post("/change-password", requireAuth, asyncHandler(controller.changePassword));
  // Engine revocation check (machine-to-machine, X-Node-Auth).
  router.post("/check", requireNodeAuth, controller.check);

  return router;
}
