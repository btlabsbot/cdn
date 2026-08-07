import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
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
    return new Map(parsed.map((node) => [node.id, node]));
  } catch (err) {
    console.error(`[api-gateway] failed to read ${DATA_FILE}, starting empty:`, (err as Error).message);
    return new Map();
  }
}

export function saveNodes(nodes: Map<string, Node>): void {
  try {
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
    }
    writeFileSync(DATA_FILE, JSON.stringify(Array.from(nodes.values()), null, 2), "utf-8");
  } catch (err) {
    console.error(`[api-gateway] failed to persist to ${DATA_FILE}:`, (err as Error).message);
  }
}

export function dataFilePath(): string {
  return DATA_FILE;
}
