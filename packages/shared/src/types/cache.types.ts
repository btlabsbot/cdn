export interface CacheEntry {
  key: string;
  value: Buffer;
  contentType: string;
  size: number; // bytes
  createdAt: number; // epoch ms
  lastAccessedAt: number; // epoch ms
}

export interface CacheStats {
  hits: number;
  misses: number;
  sizeBytes: number;
  maxSizeBytes: number;
  itemCount: number;
}

export interface CacheStrategy {
  get(key: string): CacheEntry | undefined;
  set(entry: CacheEntry): void;
  has(key: string): boolean;
  delete(key: string): boolean;
  clear(): void;
  stats(): CacheStats;
}
