import type { Response } from "express";
import { loginSchema, registerSchema, changePasswordSchema, serializeCookie } from "@lynxnodes/shared";
import type { AuthService } from "../services/auth.service";
import { SESSION_COOKIE, type AuthedRequest } from "../middleware/requireAuth";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function setSessionCookie(req: AuthedRequest, res: Response, token: string): void {
  res.setHeader(
    "Set-Cookie",
    serializeCookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "Lax",
      secure: req.protocol === "https",
      maxAgeSeconds: SESSION_TTL_SECONDS,
    })
  );
}

export function createAuthController(authService: AuthService) {
  function config(_req: AuthedRequest, res: Response): void {
    res.json({ registrationEnabled: authService.isRegistrationAllowed() });
  }

  function login(req: AuthedRequest, res: Response): void {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" });
      return;
    }

    const token = authService.login(parsed.data.username, parsed.data.password);
    if (!token) {
      res.status(401).json({ error: "Usuario o contraseña incorrectos" });
      return;
    }

    setSessionCookie(req, res, token);
    res.json({ username: parsed.data.username });
  }

  function register(req: AuthedRequest, res: Response): void {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" });
      return;
    }

    const result = authService.register(parsed.data.username, parsed.data.password);
    if ("error" in result) {
      res.status(409).json({ error: result.error });
      return;
    }

    setSessionCookie(req, res, result.token);
    res.status(201).json({ username: parsed.data.username });
  }

  function logout(req: AuthedRequest, res: Response): void {
    res.setHeader(
      "Set-Cookie",
      serializeCookie(SESSION_COOKIE, "", {
        httpOnly: true,
        sameSite: "Lax",
        secure: req.protocol === "https",
        maxAgeSeconds: 0,
      })
    );
    res.json({ ok: true });
  }

  function me(req: AuthedRequest, res: Response): void {
    // requireAuth already ran for this route, so authUser is guaranteed here.
    res.json({ username: req.authUser!.sub });
  }

  function changePassword(req: AuthedRequest, res: Response): void {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" });
      return;
    }

    const ok = authService.changePassword(
      req.authUser!.sub,
      parsed.data.currentPassword,
      parsed.data.newPassword
    );
    if (!ok) {
      res.status(401).json({ error: "La contraseña actual no es correcta" });
      return;
    }

    // Sessions are keyed off the username only, so the existing session
    // cookie is still valid after this — no need to force a re-login.
    res.json({ ok: true });
  }

  return { config, login, register, logout, me, changePassword };
}
