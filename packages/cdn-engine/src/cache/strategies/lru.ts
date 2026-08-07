/**
 * Pure LRU eviction policy. Tracks the order keys were touched.
 * Does NOT hold the actual cached values — that's storage's job.
 * This keeps eviction logic swappable (e.g. add ttl.ts later) without
 * touching the storage layer.
 */
export class LRUEvictionPolicy {
  private order: Map<string, true> = new Map();

  /** Mark a key as just-used (moves it to the "most recent" end). */
  touch(key: string): void {
    if (this.order.has(key)) {
      this.order.delete(key);
    }
    this.order.set(key, true);
  }

  /** Stop tracking a key (e.g. after explicit delete). */
  remove(key: string): void {
    this.order.delete(key);
  }

  /** Returns the least-recently-used key, or undefined if empty. */
  peekLRU(): string | undefined {
    const first = this.order.keys().next();
    return first.done ? undefined : first.value;
  }

  /** Evicts and returns the least-recently-used key. */
  evictLRU(): string | undefined {
    const key = this.peekLRU();
    if (key !== undefined) {
      this.order.delete(key);
    }
    return key;
  }

  clear(): void {
    this.order.clear();
  }

  size(): number {
    return this.order.size;
  }
}
