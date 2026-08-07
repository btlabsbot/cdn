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
    adminUsername: process.env.ADMIN_USERNAME ?? "admin",
    adminPassword: process.env.ADMIN_PASSWORD ?? "admin",
    authSecret: authSecret ?? "dev-only-insecure-secret-change-me",
    allowRegistration: process.env.ALLOW_REGISTRATION !== "false",
  };
}
