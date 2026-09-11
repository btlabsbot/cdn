import type { Request, Response } from "express";
import { loginSchema, registerSchema, changePasswordSchema, serializeCookie } from "@lynxnodes/shared";
import type { GatewayConfig } from "../config/env";
import type { AuthService } from "../services/auth.service";
import { SESSION_COOKIE, type AuthedRequest } from "../middleware/requireAuth";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function setSessionCookie(req: AuthedRequest, res: Response, token: string, secureCookies: boolean): void {
  // Never trust req.protocol behind a TLS-terminating proxy (trust proxy=false):
  // Secure is driven by explicit config (production or COOKIE_SECURE=true).
  void req;
  res.setHeader(
    "Set-Cookie",
    serializeCookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "Lax",
      secure: secureCookies,
      maxAgeSeconds: SESSION_TTL_SECONDS,
    })
  );
}

export function createAuthController(authService: AuthService, config: GatewayConfig) {
  function configRoute(_req: AuthedRequest, res: Response): void {
    res.json({ registrationEnabled: authService.isRegistrationAllowed() });
  }

  async function login(req: AuthedRequest, res: Response): Promise<void> {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" });
      return;
    }

    const token = await authService.login(parsed.data.username, parsed.data.password);
    if (!token) {
      res.status(401).json({ error: "Usuario o contraseña incorrectos" });
      return;
    }

    setSessionCookie(req, res, token, config.secureCookies);
    res.json({ username: parsed.data.username });
  }

  async function register(req: AuthedRequest, res: Response): Promise<void> {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" });
      return;
    }

    const result = await authService.register(parsed.data.username, parsed.data.password);
    if ("error" in result) {
      const status = result.error === "Ese usuario ya existe" ? 409 : 403;
      res.status(status).json({ error: result.error });
      return;
    }

    setSessionCookie(req, res, result.token, config.secureCookies);
    res.status(201).json({ username: parsed.data.username });
  }

  function logout(req: AuthedRequest, res: Response): void {
    res.setHeader(
      "Set-Cookie",
      serializeCookie(SESSION_COOKIE, "", {
        httpOnly: true,
        sameSite: "Lax",
        secure: config.secureCookies,
        maxAgeSeconds: 0,
      })
    );
    void req;
    res.json({ ok: true });
  }

  function me(req: AuthedRequest, res: Response): void {
    // requireAuth already ran for this route, so authUser is guaranteed here.
    res.json({ username: req.authUser!.sub });
  }

  async function changePassword(req: AuthedRequest, res: Response): Promise<void> {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" });
      return;
    }

    const ok = await authService.changePassword(
      req.authUser!.sub,
      parsed.data.currentPassword,
      parsed.data.newPassword
    );
    if (!ok) {
      res.status(401).json({ error: "La contraseña actual no es correcta" });
      return;
    }

    // Password changes increment the user's session version, revoking existing
    // cookies. The client must authenticate again with the new password.
    res.json({ ok: true });
  }

  /** Machine-to-machine: cdn-engine forwards a browser cookie to check `ver` revocation. */
  function check(req: Request, res: Response): void {
    const token = typeof req.body?.token === "string" ? req.body.token : undefined;
    const payload = authService.verify(token);
    if (!payload) {
      res.status(401).json({ valid: false });
      return;
    }
    res.json({ valid: true, sub: payload.sub, ver: payload.ver ?? 0 });
  }

  return { config: configRoute, login, register, logout, me, changePassword, check };
}
