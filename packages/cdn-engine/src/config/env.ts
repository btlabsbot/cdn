import { join, resolve } from "node:path";
import { parseIntEnv, requireStrongSecret } from "@lynxnodes/shared";

export interface EngineConfig {
  port: number;
  nodeId: string;
  region: string;
  cacheMaxSizeBytes: number;
  gatewayUrl: string | null;
  heartbeatIntervalMs: number;
  uploadsDir: string;
  authSecret: string;
  nodeAuthSecret: string;
  proxyMaxBytes: number;
  proxyTimeoutMs: number;
  corsOrigins: string[];
}

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export function loadConfig(): EngineConfig {
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

  const uploadsRaw = process.env.UPLOADS_DIR ?? join(process.cwd(), "uploads");
  if (!uploadsRaw.trim()) throw new Error("UPLOADS_DIR must not be empty");
  const uploadsDir = resolve(uploadsRaw);
  if (uploadsDir === "/" || uploadsDir === resolve("/")) {
    throw new Error("UPLOADS_DIR must not be the filesystem root");
  }

  return {
    port: parseIntEnv("PORT", process.env.PORT, 8080, { min: 1, max: 65535 }),
    nodeId: required("NODE_ID", "local-dev-node"),
    region: required("NODE_REGION", "local"),
    cacheMaxSizeBytes: parseIntEnv("CACHE_MAX_SIZE_BYTES", process.env.CACHE_MAX_SIZE_BYTES, 256 * 1024 * 1024, { min: 1 }),
    gatewayUrl: process.env.GATEWAY_URL ?? null,
    heartbeatIntervalMs: parseIntEnv("HEARTBEAT_INTERVAL_MS", process.env.HEARTBEAT_INTERVAL_MS, 10000, { min: 1000 }),
    uploadsDir,
    authSecret,
    nodeAuthSecret,
    proxyMaxBytes: parseIntEnv("PROXY_MAX_BYTES", process.env.PROXY_MAX_BYTES, 10 * 1024 * 1024, { min: 1 }),
    proxyTimeoutMs: parseIntEnv("PROXY_TIMEOUT_MS", process.env.PROXY_TIMEOUT_MS, 10000, { min: 500 }),
    corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:3001")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  };
}
