import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = process.env.DATA_DIR ?? join(process.cwd(), "data");
const DATA_FILE = join(DATA_DIR, "auth.json");

export interface StoredUser {
  username: string;
  salt: string; // hex
  hash: string; // hex
  createdAt: string;
}

interface LegacyStoredCredential {
  username: string;
  salt: string;
  hash: string;
}

export function loadUsers(): StoredUser[] {
  if (!existsSync(DATA_FILE)) return [];

  try {
    const raw = readFileSync(DATA_FILE, "utf-8");
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed?.users)) {
      return parsed.users as StoredUser[];
    }

    const legacy = parsed as LegacyStoredCredential;
    if (legacy?.username && legacy?.salt && legacy?.hash) {
      return [{ ...legacy, createdAt: new Date().toISOString() }];
    }

    return [];
  } catch (err) {
    console.error(`[api-gateway] failed to read ${DATA_FILE}, starting empty:`, (err as Error).message);
    return [];
  }
}

export function saveUsers(users: StoredUser[]): void {
  try {
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
    }
    writeFileSync(DATA_FILE, JSON.stringify({ users }, null, 2), "utf-8");
  } catch (err) {
    console.error(`[api-gateway] failed to persist to ${DATA_FILE}:`, (err as Error).message);
  }
}
