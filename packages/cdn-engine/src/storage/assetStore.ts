import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

export interface AssetMeta {
  filename: string;
  contentType: string;
  size: number; // bytes
  uploadedAt: string; // ISO
}

const METADATA_FILE = "assets.json";

export class AssetStore {
  private readonly dir: string;
  private readonly metaPath: string;
  private index: Map<string, AssetMeta>;

  constructor(uploadsDir: string) {
    this.dir = uploadsDir;
    this.metaPath = join(uploadsDir, METADATA_FILE);

    if (!existsSync(this.dir)) {
      mkdirSync(this.dir, { recursive: true });
    }

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
      return new Map(parsed.map((asset) => [asset.filename, asset]));
    } catch (err) {
      console.error(
        `[cdn-engine] failed to read asset index (${this.metaPath}), starting empty: ${(err as Error).message}`
      );
      return new Map();
    }
  }

  private persistIndex(): void {
    try {
      writeFileSync(this.metaPath, JSON.stringify(Array.from(this.index.values()), null, 2), "utf-8");
    } catch (err) {
      console.error(`[cdn-engine] failed to persist asset index: ${(err as Error).message}`);
    }
  }

  /** Saves a new file (or replaces an existing one with the same name). */
  save(filename: string, contentType: string, buffer: Buffer): AssetMeta {
    const filePath = join(this.dir, filename);
    writeFileSync(filePath, buffer);

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
