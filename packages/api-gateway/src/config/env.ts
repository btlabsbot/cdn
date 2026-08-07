export interface GatewayConfig {
  port: number;
  adminUsername: string;
  adminPassword: string;
  authSecret: string;
  allowRegistration: boolean;
}

export function loadConfig(): GatewayConfig {
  const authSecret = process.env.AUTH_SECRET;
  if (!authSecret && process.env.NODE_ENV === "production") {
    throw new Error("Missing required env var: AUTH_SECRET (needed to sign login sessions)");
  }

  return {
    port: parseInt(process.env.PORT ?? "3000", 10),
    // Default admin/admin so the alpha runs out of the box — only used to
    // seed the very first account, see auth.service.ts.
    adminUsername: process.env.ADMIN_USERNAME ?? "admin",
    adminPassword: process.env.ADMIN_PASSWORD ?? "admin",
    // Must match cdn-engine's AUTH_SECRET: it verifies the same session
    // cookie so uploads/deletes there also require login.
    authSecret: authSecret ?? "dev-only-insecure-secret-change-me",
    // Off by default — anyone who can reach api-gateway would otherwise be
    // able to create an account with full dashboard/upload access. Turn it
    // on only if you actually want open self-registration:
    //   ALLOW_REGISTRATION=true
    allowRegistration: process.env.ALLOW_REGISTRATION === "true",
  };
}
