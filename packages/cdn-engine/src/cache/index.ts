import type { CacheStrategy } from "@lynxnodes/shared";
import { MemoryStorage } from "./storage/memory";

export interface CacheConfig {
  maxSizeBytes: number;
}

/**
 * Factory. Today this only builds in-memory LRU cache, but callers depend
 * on the CacheStrategy interface, so swapping in disk.ts or ttl.ts later
 * won't require changes to routes/proxy.ts.
 */
export function createCache(config: CacheConfig): CacheStrategy {
  return new MemoryStorage({ maxSizeBytes: config.maxSizeBytes });
}

export type { CacheStrategy };
