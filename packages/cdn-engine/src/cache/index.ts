import type { CacheStrategy } from "@lynxnodes/shared";
import { MemoryStorage } from "./storage/memory";

export interface CacheConfig {
  maxSizeBytes: number;
}

export function createCache(config: CacheConfig): CacheStrategy {
  return new MemoryStorage({ maxSizeBytes: config.maxSizeBytes });
}

export type { CacheStrategy };
