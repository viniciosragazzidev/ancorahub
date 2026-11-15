import "server-only";

import { TtlCache } from "@/shared/cache/ttl-cache";

/**
 * Short in-process cache for plantão configuration read on every distribution
 * step (Supabase egress, 15/11): the published-plantões list ran 12.5 million
 * times and the active-schedule list 15.8 million times since 26/10, a few rows
 * each. Only configuration is cached here, never presence, pauses or offers:
 * those keep being read live. An edit shows up within DUTY_CONFIG_TTL_MS.
 */
export const DUTY_CONFIG_TTL_MS = 15_000;

export function createDutyConfigCache<V>() {
  const cache = new TtlCache<V>(DUTY_CONFIG_TTL_MS, 500);
  return {
    /** Cached value, loaded once per key and TTL. Tests always load (each one mocks its own rows). */
    get(key: string, load: () => Promise<V>): Promise<V> {
      if (process.env.NODE_ENV === "test") return load();
      return cache.getOrLoad(key, load);
    },
  };
}
