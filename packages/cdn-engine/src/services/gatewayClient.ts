import { statfs } from "node:fs/promises";
import type { CacheStrategy } from "@lynxnodes/shared";
import type { EngineConfig } from "../config/env";

interface RegisteredNode {
  id: string;
}

async function readDiskUsagePct(path: string): Promise<number> {
  try {
    const stats = await statfs(path);
    const total = stats.blocks * stats.bsize;
    if (total <= 0) return 0;
    const free = stats.bfree * stats.bsize;
    const used = total - free;
    return Math.round((used / total) * 1000) / 10; // one decimal place
  } catch (err) {
    console.error(`[cdn-engine] could not read disk usage: ${(err as Error).message}`);
    return 0;
  }
}


export function startGatewayReporting(cache: CacheStrategy, config: EngineConfig): void {
  if (!config.gatewayUrl) {
    console.log("[cdn-engine] GATEWAY_URL not set — running standalone, no heartbeats sent");
    return;
  }

  const gatewayUrl = config.gatewayUrl;
  let registeredNode: RegisteredNode | null = null;

  let lastLatencyMs = 0;

  async function registerSelf(): Promise<void> {
    try {
      const res = await fetch(`${gatewayUrl}/api/v1/nodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostname: config.nodeId, region: config.region }),
      });

      if (!res.ok) {
        console.error(`[cdn-engine] registration failed: gateway responded ${res.status}`);
        return;
      }

      registeredNode = (await res.json()) as RegisteredNode;
      console.log(`[cdn-engine] registered with gateway as node ${registeredNode.id}`);
    } catch (err) {
      console.error(`[cdn-engine] could not reach gateway to register: ${(err as Error).message}`);
    }
  }

  async function sendHeartbeat(): Promise<void> {
    if (!registeredNode) {
      await registerSelf();
      if (!registeredNode) return;
    }

    const stats = cache.stats();
    const totalRequests = stats.hits + stats.misses;
    const cacheHitRate = totalRequests > 0 ? stats.hits / totalRequests : 0;
    const diskUsagePct = await readDiskUsagePct(config.uploadsDir);

    try {
      const start = Date.now();
      const res = await fetch(`${gatewayUrl}/api/v1/nodes/${registeredNode.id}/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "online", cacheHitRate, diskUsagePct, latencyMs: lastLatencyMs }),
      });
      lastLatencyMs = Date.now() - start;

      if (res.status === 404) {
        // Gateway restarted and lost its in-memory registry — re-register.
        console.warn("[cdn-engine] gateway doesn't recognize this node, re-registering");
        registeredNode = null;
      } else if (!res.ok) {
        console.error(`[cdn-engine] heartbeat failed: gateway responded ${res.status}`);
      }
    } catch (err) {
      console.error(`[cdn-engine] heartbeat request failed: ${(err as Error).message}`);
    }
  }

  registerSelf().then(() => {
    setInterval(sendHeartbeat, config.heartbeatIntervalMs);
  });
}
