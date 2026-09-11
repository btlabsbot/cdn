import type { CacheEntry, CacheStats, CacheStrategy } from "@lynxnodes/shared";
import { LRUEvictionPolicy } from "../strategies/lru";

export interface MemoryStorageConfig {
  maxSizeBytes: number;
}

export class MemoryStorage implements CacheStrategy {
  private entries: Map<string, CacheEntry> = new Map();
  private eviction = new LRUEvictionPolicy();
  private sizeBytes = 0;
  private hitCount = 0;
  private missCount = 0;
  private readonly maxSizeBytes: number;

  constructor(config: MemoryStorageConfig) {
    this.maxSizeBytes = config.maxSizeBytes;
  }

  get(key: string): CacheEntry | undefined {
    const entry = this.entries.get(key);
    if (!entry) {
      this.missCount++;
      return undefined;
    }
    this.hitCount++;
    entry.lastAccessedAt = Date.now();
    this.eviction.touch(key);
    // Return a copy: callers must not mutate the cached Buffer in place.
    return { ...entry, value: Buffer.from(entry.value) };
  }

  set(entry: CacheEntry): void {
    if (entry.size > this.maxSizeBytes) {
      return;
    }

    const copy: CacheEntry = { ...entry, value: Buffer.from(entry.value) };
    const existing = this.entries.get(copy.key);
    if (existing) {
      this.sizeBytes -= existing.size;
      this.entries.delete(copy.key);
      this.eviction.remove(copy.key);
    }

    while (this.sizeBytes + copy.size > this.maxSizeBytes && this.entries.size > 0) {
      const evictKey = this.eviction.evictLRU();
      if (evictKey === undefined) break;
      const evicted = this.entries.get(evictKey);
      if (evicted) {
        this.sizeBytes -= evicted.size;
        this.entries.delete(evictKey);
      }
    }

    this.entries.set(copy.key, copy);
    this.eviction.touch(copy.key);
    this.sizeBytes += copy.size;
  }

  has(key: string): boolean {
    return this.entries.has(key);
  }

  delete(key: string): boolean {
    const entry = this.entries.get(key);
    if (!entry) return false;
    this.sizeBytes -= entry.size;
    this.entries.delete(key);
    this.eviction.remove(key);
    return true;
  }

  clear(): void {
    this.entries.clear();
    this.eviction.clear();
    this.sizeBytes = 0;
    this.hitCount = 0;
    this.missCount = 0;
  }

  stats(): CacheStats {
    return {
      hits: this.hitCount,
      misses: this.missCount,
      sizeBytes: this.sizeBytes,
      maxSizeBytes: this.maxSizeBytes,
      itemCount: this.entries.size,
    };
  }
}
