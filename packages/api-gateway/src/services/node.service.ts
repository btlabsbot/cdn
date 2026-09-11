import { randomUUID } from "node:crypto";
import type { Node, RegisterNodeInput, HeartbeatInput } from "@lynxnodes/shared";
import { loadNodes, saveNodes, dataFilePath } from "./store";

class NodeService {
  private nodes: Map<string, Node> = new Map();
  private lastPersistAt = 0;
  private static readonly PERSIST_THROTTLE_MS = 30_000;

  constructor() {
    // loadNodes throws CorruptStoreError on corruption -> crash startup closed.
    this.nodes = loadNodes();
    console.log(`[api-gateway] loaded ${this.nodes.size} node(s) from ${dataFilePath()}`);
  }

  private persist(force = false): void {
    if (!force) {
      const now = Date.now();
      if (now - this.lastPersistAt < NodeService.PERSIST_THROTTLE_MS) return;
      this.lastPersistAt = now;
    } else {
      this.lastPersistAt = Date.now();
    }
    saveNodes(this.nodes);
  }

  register(input: RegisterNodeInput): Node {
    const existing = this.findByHostname(input.hostname);
    const now = new Date().toISOString();

    if (existing) {
      // Idempotent re-register (same NODE_ID after restart): refresh liveness
      // but NEVER overwrite region. X-Node-Auth is a single shared secret, so
      // any node could otherwise spoof another hostname's region.
      // Per-node tokens are the proper fix (roadmap); this limits the blast radius.
      existing.status = "online";
      existing.lastSeen = now;
      this.persist(true);
      return existing;
    }

    const node: Node = {
      id: randomUUID(),
      hostname: input.hostname,
      region: input.region,
      status: "online",
      cacheHitRate: 0,
      diskUsagePct: 0,
      latencyMs: 0,
      lastSeen: now,
      createdAt: now,
    };
    this.nodes.set(node.id, node);
    this.persist(true);
    return node;
  }

  findByHostname(hostname: string): Node | undefined {
    return Array.from(this.nodes.values()).find((n) => n.hostname === hostname);
  }

  list(): Node[] {
    return Array.from(this.nodes.values());
  }

  getById(id: string): Node | undefined {
    return this.nodes.get(id);
  }

  heartbeat(id: string, input: HeartbeatInput): Node | undefined {
    const node = this.nodes.get(id);
    if (!node) return undefined;

    const statusChanged = node.status !== input.status;
    node.status = input.status;
    node.cacheHitRate = input.cacheHitRate;
    if (input.diskUsagePct !== undefined) node.diskUsagePct = input.diskUsagePct;
    if (input.latencyMs !== undefined) node.latencyMs = input.latencyMs;
    node.lastSeen = new Date().toISOString();
    // Heartbeats arrive every ~10s per node: throttle disk writes, force on status flips.
    this.persist(statusChanged);
    return node;
  }

  remove(id: string): boolean {
    const deleted = this.nodes.delete(id);
    if (deleted) this.persist(true);
    return deleted;
  }
}

// Singleton — fine for a single-process alpha.
export const nodeService = new NodeService();
