export interface GatewayConfig {
  port: number;
  adminUsername: string;
  adminPassword: string;
  authSecret: string;
  nodeAuthSecret: string;
  allowRegistration: boolean;
  corsOrigins: string[];
}

export function loadConfig(): GatewayConfig {
  const authSecret = process.env.AUTH_SECRET;
  const nodeAuthSecret = process.env.NODE_AUTH_SECRET;
  if (process.env.NODE_ENV === "production" && (!authSecret || !nodeAuthSecret)) {
    throw new Error("AUTH_SECRET and NODE_AUTH_SECRET are required in production");
  }

  return {
    port: parseInt(process.env.PORT ?? "3000", 10),
    adminUsername: process.env.ADMIN_USERNAME ?? "admin",
    adminPassword: process.env.ADMIN_PASSWORD ?? "admin",
    authSecret: authSecret ?? "dev-only-insecure-secret-change-me",
    nodeAuthSecret: nodeAuthSecret ?? "dev-only-node-secret-change-me",
    allowRegistration: process.env.ALLOW_REGISTRATION === "true",
    corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:3001")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  };
}
