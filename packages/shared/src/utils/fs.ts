import { existsSync, mkdirSync, writeFileSync, renameSync } from "node:fs";
import { dirname } from "node:path";
import { randomBytes } from "node:crypto";

export class CorruptStoreError extends Error {
  constructor(public readonly path: string, public readonly cause: unknown) {
    super(`Corrupt store file: ${path}: ${(cause as Error)?.message ?? cause}`);
    this.name = "CorruptStoreError";
  }
}

/** Ensures a directory exists with restrictive permissions. */
export function ensureDirSync(dir: string, mode = 0o700): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode });
  }
}

/**
 * Atomic JSON/file write: write to tmp + rename. Never leaves a truncated
 * file behind on crash. Uses mode 0o600 by default (secrets, indexes).
 */
export function atomicWriteFileSync(path: string, data: string | Buffer, mode = 0o600): void {
  ensureDirSync(dirname(path));
  const tmp = `${path}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
  writeFileSync(tmp, data, { mode });
  renameSync(tmp, path);
}

/** Atomic JSON write helper (pretty-printed). */
export function atomicWriteJsonSync(path: string, value: unknown, mode = 0o600): void {
  atomicWriteFileSync(path, JSON.stringify(value, null, 2), mode);
}
