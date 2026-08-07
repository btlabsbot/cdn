export class LRUEvictionPolicy {
  private order: Map<string, true> = new Map();

  touch(key: string): void {
    if (this.order.has(key)) {
      this.order.delete(key);
    }
    this.order.set(key, true);
  }

  remove(key: string): void {
    this.order.delete(key);
  }

  peekLRU(): string | undefined {
    const first = this.order.keys().next();
    return first.done ? undefined : first.value;
  }

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
