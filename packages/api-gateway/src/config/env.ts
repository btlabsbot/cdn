import { parseIntEnv, requireStrongSecret } from "@lynxnodes/shared";

export interface GatewayConfig {
  port: number;
  adminUsername: string;
  adminPassword: string;
  authSecret: string;
  nodeAuthSecret: string;
  allowRegistration: boolean;
  corsOrigins: string[];
  secureCookies: boolean;
}

export function loadConfig(): GatewayConfig {
  const authSecret = requireStrongSecret(
    "AUTH_SECRET",
    process.env.AUTH_SECRET,
    "dev-only-insecure-secret-change-me"
  );
  const nodeAuthSecret = requireStrongSecret(
    "NODE_AUTH_SECRET",
    process.env.NODE_AUTH_SECRET,
    "dev-only-node-secret-change-me"
  );
  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;

  return {
    port: parseIntEnv("PORT", process.env.PORT, 3000, { min: 1, max: 65535 }),
    adminUsername: adminUsername ?? "admin",
    adminPassword: adminPassword ?? "admin",
    authSecret,
    nodeAuthSecret,
    allowRegistration: process.env.ALLOW_REGISTRATION === "true",
    corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:3001")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    secureCookies: process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production",
  };
}
