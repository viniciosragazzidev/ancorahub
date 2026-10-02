/**
 * Small in-process cache with expiry, for hot reads that change rarely
 * (settings, the signed-in user's session and membership). The CRM runs as one
 * long-lived Node process on the VPS, so this saves a database round trip per
 * request; every entry expires on its own, so changes show up within the TTL.
 * Concurrent misses for the same key share one load.
 */
export class TtlCache<V> {
  private readonly entries = new Map<string, { expiresAt: number; value: V }>();
  private readonly loading = new Map<string, Promise<V>>();

  constructor(private readonly ttlMs: number, private readonly maxEntries = 1000) {}

  get(key: string): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: V) {
    if (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.set(key, { expiresAt: Date.now() + this.ttlMs, value });
  }

  delete(key: string) {
    this.entries.delete(key);
  }

  clear() {
    this.entries.clear();
  }

  /** Cached value, or `load()` once (shared by concurrent callers) and cache it. */
  async getOrLoad(key: string, load: () => Promise<V>, shouldCache: (value: V) => boolean = () => true): Promise<V> {
    const cached = this.get(key);
    if (cached !== undefined) return cached;
    const pending = this.loading.get(key);
    if (pending) return pending;
    const promise = load()
      .then((value) => {
        if (shouldCache(value)) this.set(key, value);
        return value;
      })
      .finally(() => this.loading.delete(key));
    this.loading.set(key, promise);
    return promise;
  }
}
