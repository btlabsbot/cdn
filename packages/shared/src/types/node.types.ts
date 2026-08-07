export type NodeStatus = "online" | "offline" | "degraded";

export interface Node {
  id: string;
  hostname: string;
  region: string;
  status: NodeStatus;
  cacheHitRate: number;
  diskUsagePct: number; // 0-100, % of disk used by this node
  latencyMs: number; // round-trip latency to the gateway, in ms
  lastSeen: string; // ISO timestamp
  createdAt: string; // ISO timestamp
}

export interface RegisterNodeInput {
  hostname: string;
  region: string;
}

export interface HeartbeatInput {
  status: NodeStatus;
  cacheHitRate: number;
  diskUsagePct?: number;
  latencyMs?: number;
}
