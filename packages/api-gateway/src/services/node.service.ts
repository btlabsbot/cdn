import { randomUUID } from "node:crypto";
import type { Node, RegisterNodeInput, HeartbeatInput } from "@lynxnodes/shared";
import { loadNodes, saveNodes, dataFilePath } from "./store";

class NodeService {
  private nodes: Map<string, Node> = loadNodes();

  constructor() {
    console.log(`[api-gateway] loaded ${this.nodes.size} node(s) from ${dataFilePath()}`);
  }

  private persist(): void {
    saveNodes(this.nodes);
  }

  register(input: RegisterNodeInput): Node {
    const existing = this.findByHostname(input.hostname);
    const now = new Date().toISOString();

    if (existing) {
      existing.region = input.region;
      existing.status = "online";
      existing.lastSeen = now;
      this.persist();
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
    this.persist();
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

    node.status = input.status;
    node.cacheHitRate = input.cacheHitRate;
    if (input.diskUsagePct !== undefined) node.diskUsagePct = input.diskUsagePct;
    if (input.latencyMs !== undefined) node.latencyMs = input.latencyMs;
    node.lastSeen = new Date().toISOString();
    this.persist();
    return node;
  }

  remove(id: string): boolean {
    const deleted = this.nodes.delete(id);
    if (deleted) this.persist();
    return deleted;
  }
}

// Singleton — fine for a single-process alpha.
export const nodeService = new NodeService();
