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
    // If unset, cdn-engine simply runs standalone and skips heartbeats —
    // useful for testing the cache in isolation without a gateway running.
    gatewayUrl: process.env.GATEWAY_URL ?? null,
    heartbeatIntervalMs: parseInt(process.env.HEARTBEAT_INTERVAL_MS ?? "10000", 10),
    // Directory where files uploaded via /upload are stored.
    uploadsDir: process.env.UPLOADS_DIR ?? join(process.cwd(), "uploads"),
    // Must match api-gateway's AUTH_SECRET: cdn-engine only verifies the
    // session cookie issued at login there, it never issues its own.
    authSecret: process.env.AUTH_SECRET ?? "dev-only-insecure-secret-change-me",
  };
}
