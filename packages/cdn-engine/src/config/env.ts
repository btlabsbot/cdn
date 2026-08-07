import { join } from "node:path";

export interface EngineConfig {
  port: number;
  nodeId: string;
  region: string;
  cacheMaxSizeBytes: number;
  gatewayUrl: string | null;
  heartbeatIntervalMs: number;
  uploadsDir: string;
  authSecret: string;
}

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export function loadConfig(): EngineConfig {
  return {
    port: parseInt(process.env.PORT ?? "8080", 10),
    nodeId: required("NODE_ID", "local-dev-node"),
    region: required("NODE_REGION", "local"),
    cacheMaxSizeBytes: parseInt(process.env.CACHE_MAX_SIZE_BYTES ?? String(256 * 1024 * 1024), 10),
    gatewayUrl: process.env.GATEWAY_URL ?? null,
    heartbeatIntervalMs: parseInt(process.env.HEARTBEAT_INTERVAL_MS ?? "10000", 10),
    uploadsDir: process.env.UPLOADS_DIR ?? join(process.cwd(), "uploads"),
    authSecret: process.env.AUTH_SECRET ?? "dev-only-insecure-secret-change-me",
  };
}
