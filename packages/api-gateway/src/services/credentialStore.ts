import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { atomicWriteJsonSync, CorruptStoreError, ensureDirSync } from "@lynxnodes/shared";

const DATA_DIR = process.env.DATA_DIR ?? join(process.cwd(), "data");
const DATA_FILE = join(DATA_DIR, "auth.json");

export interface StoredUser {
  username: string;
  salt: string; // hex
  hash: string; // hex
  createdAt: string;
  sessionVersion?: number;
}

interface LegacyStoredCredential {
  username: string;
  salt: string;
  hash: string;
}

export function loadUsers(): StoredUser[] {
  if (!existsSync(DATA_FILE)) return [];

  let parsed: unknown;
  try {
    const raw = readFileSync(DATA_FILE, "utf-8");
    parsed = JSON.parse(raw);
  } catch (err) {
    // Fail closed: never return [] on corruption (that would trigger re-seed and wipe users).
    throw new CorruptStoreError(DATA_FILE, err);
  }

  try {
    if (Array.isArray((parsed as { users?: unknown })?.users)) {
      return (parsed as { users: StoredUser[] }).users;
    }

    const legacy = parsed as LegacyStoredCredential;
    if (legacy?.username && legacy?.salt && legacy?.hash) {
      return [{ ...legacy, createdAt: new Date().toISOString() }];
    }

    throw new Error("unrecognized auth.json shape");
  } catch (err) {
    if (err instanceof CorruptStoreError) throw err;
    throw new CorruptStoreError(DATA_FILE, err);
  }
}

export function saveUsers(users: StoredUser[]): void {
  try {
    ensureDirSync(DATA_DIR, 0o700);
    atomicWriteJsonSync(DATA_FILE, { users }, 0o600);
  } catch (err) {
    console.error(`[api-gateway] failed to persist to ${DATA_FILE}:`, (err as Error).message);
  }
}
