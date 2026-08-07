import { Router } from "express";
import type { AuthService } from "../../services/auth.service";
import { createAuthController } from "../../controllers/auth.controller";
import { createRequireAuth } from "../../middleware/requireAuth";

export function createAuthRouter(authService: AuthService): Router {
  const router = Router();
  const controller = createAuthController(authService);
  const requireAuth = createRequireAuth(authService);

  router.get("/config", controller.config);
  router.post("/login", controller.login);
  router.post("/register", controller.register);
  router.post("/logout", controller.logout);
  router.get("/me", requireAuth, controller.me);
  router.post("/change-password", requireAuth, controller.changePassword);

  return router;
}
