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
    return entry;
  }

  set(entry: CacheEntry): void {
    if (entry.size > this.maxSizeBytes) {
      return;
    }

    const existing = this.entries.get(entry.key);
    if (existing) {
      this.sizeBytes -= existing.size;
    }

    while (this.sizeBytes + entry.size > this.maxSizeBytes && this.entries.size > 0) {
      const evictKey = this.eviction.evictLRU();
      if (evictKey === undefined) break;
      const evicted = this.entries.get(evictKey);
      if (evicted) {
        this.sizeBytes -= evicted.size;
        this.entries.delete(evictKey);
      }
    }

    this.entries.set(entry.key, entry);
    this.eviction.touch(entry.key);
    this.sizeBytes += entry.size;
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
