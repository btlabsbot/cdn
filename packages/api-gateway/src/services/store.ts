import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { atomicWriteJsonSync, CorruptStoreError, ensureDirSync } from "@lynxnodes/shared";
import type { Node } from "@lynxnodes/shared";

const DATA_DIR = process.env.DATA_DIR ?? join(process.cwd(), "data");
const DATA_FILE = join(DATA_DIR, "nodes.json");

export function loadNodes(): Map<string, Node> {
  if (!existsSync(DATA_FILE)) {
    return new Map();
  }

  try {
    const raw = readFileSync(DATA_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Node[];
    if (!Array.isArray(parsed)) throw new Error("nodes.json is not an array");
    return new Map(parsed.map((node) => [node.id, node]));
  } catch (err) {
    // Fail closed: corruption must crash startup, never silently wipe the fleet.
    throw new CorruptStoreError(DATA_FILE, err);
  }
}

export function saveNodes(nodes: Map<string, Node>): void {
  try {
    ensureDirSync(DATA_DIR, 0o700);
    atomicWriteJsonSync(DATA_FILE, Array.from(nodes.values()), 0o600);
  } catch (err) {
    console.error(`[api-gateway] failed to persist to ${DATA_FILE}:`, (err as Error).message);
    throw err;
  }
}

export function dataFilePath(): string {
  return DATA_FILE;
}
