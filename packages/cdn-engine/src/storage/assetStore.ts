import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { atomicWriteJsonSync, CorruptStoreError, ensureDirSync } from "@lynxnodes/shared";

export interface AssetMeta {
  filename: string;
  contentType: string;
  size: number; // bytes
  uploadedAt: string; // ISO
}

const METADATA_FILE = "assets.json";

export const ASSET_INDEX_FILENAME = METADATA_FILE;

/** Defense-in-depth: rejects reserved/traversal names even if the route missed them. */
export function isSafeAssetFilename(name: string): boolean {
  if (!name || name.length > 255) return false;
  if (name.toLowerCase() === METADATA_FILE.toLowerCase()) return false;
  if (/^\.+$/.test(name)) return false;
  if (name.includes("/") || name.includes("\\") || name.includes("..")) return false;
  if (name !== name.trim()) return false;
  return /^[a-zA-Z0-9._-]+$/.test(name);
}

function assertSafeFilename(filename: string): void {
  if (!isSafeAssetFilename(filename)) {
    throw new Error(`Invalid filename: ${JSON.stringify(filename)}`);
  }
}

export class AssetStore {
  private readonly dir: string;
  private readonly metaPath: string;
  private index: Map<string, AssetMeta>;

  constructor(uploadsDir: string) {
    this.dir = uploadsDir;
    this.metaPath = join(uploadsDir, METADATA_FILE);

    ensureDirSync(this.dir, 0o700);

    this.index = this.loadIndex();
    console.log(`[cdn-engine] asset store ready: ${this.index.size} file(s) in ${this.dir}`);
  }

  private loadIndex(): Map<string, AssetMeta> {
    if (!existsSync(this.metaPath)) {
      return new Map();
    }

    try {
      const raw = readFileSync(this.metaPath, "utf-8");
      const parsed = JSON.parse(raw) as AssetMeta[];
      if (!Array.isArray(parsed)) throw new Error("index is not an array");
      return new Map(parsed.map((asset) => [asset.filename, asset]));
    } catch (err) {
      // Fail closed: never silently start empty (that would wipe orphans on next persist).
      throw new CorruptStoreError(this.metaPath, err);
    }
  }

  private persistIndex(): void {
    try {
      atomicWriteJsonSync(this.metaPath, Array.from(this.index.values()), 0o600);
    } catch (err) {
      console.error(`[cdn-engine] failed to persist asset index: ${(err as Error).message}`);
    }
  }

  /** Saves a new file (or replaces an existing one with the same name). */
  save(filename: string, contentType: string, buffer: Buffer): AssetMeta {
    assertSafeFilename(filename);
    const filePath = join(this.dir, filename);
    writeFileSync(filePath, buffer, { mode: 0o600 });

    const meta: AssetMeta = {
      filename,
      contentType,
      size: buffer.byteLength,
      uploadedAt: new Date().toISOString(),
    };

    this.index.set(filename, meta);
    this.persistIndex();
    return meta;
  }

  get(filename: string): { meta: AssetMeta; buffer: Buffer } | undefined {
    if (!isSafeAssetFilename(filename)) return undefined;
    const meta = this.index.get(filename);
    if (!meta) return undefined;

    const filePath = join(this.dir, filename);
    if (!existsSync(filePath)) {
      this.index.delete(filename);
      this.persistIndex();
      return undefined;
    }

    return { meta, buffer: readFileSync(filePath) };
  }

  has(filename: string): boolean {
    return this.index.has(filename);
  }

  list(): AssetMeta[] {
    return Array.from(this.index.values()).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  }

  delete(filename: string): boolean {
    if (!isSafeAssetFilename(filename)) return false;
    const meta = this.index.get(filename);
    if (!meta) return false;

    const filePath = join(this.dir, filename);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }

    this.index.delete(filename);
    this.persistIndex();
    return true;
  }
}
