import { Router } from "express";
import type { AuthService } from "../../services/auth.service";
import { createAuthController } from "../../controllers/auth.controller";
import { createRequireAuth } from "../../middleware/requireAuth";
import { createRateLimit } from "../../middleware/rateLimit";

export function createAuthRouter(authService: AuthService): Router {
  const router = Router();
  const controller = createAuthController(authService);
  const requireAuth = createRequireAuth(authService);
  const authRateLimit = createRateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
  const registrationRateLimit = createRateLimit({ windowMs: 60 * 60 * 1000, max: 5 });

  router.get("/config", controller.config);
  router.post("/login", authRateLimit, controller.login);
  router.post("/register", registrationRateLimit, controller.register);
  router.post("/logout", controller.logout);
  router.get("/me", requireAuth, controller.me);
  router.post("/change-password", requireAuth, controller.changePassword);

  return router;
}
