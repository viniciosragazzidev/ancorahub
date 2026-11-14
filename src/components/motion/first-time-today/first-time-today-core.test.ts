import { afterEach, describe, expect, it } from "vitest";
import {
  firstTimeTodayStorageKey,
  isFirstTimeToday,
  markSeenToday,
  resetFirstTimeTodayMemory,
  saoPauloDayKey,
} from "./first-time-today-core";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

afterEach(resetFirstTimeTodayMemory);

describe("saoPauloDayKey", () => {
  it("usa o dia civil de São Paulo, não o UTC", () => {
    // 02:30 UTC do dia 14 ainda é 23:30 do dia 13 em São Paulo (UTC-3).
    expect(saoPauloDayKey(new Date("2026-11-14T02:30:00Z"))).toBe("2026-11-13");
    expect(saoPauloDayKey(new Date("2026-11-14T03:00:00Z"))).toBe("2026-11-14");
  });
});

describe("isFirstTimeToday / markSeenToday", () => {
  const morning = new Date("2026-11-13T11:00:00Z");
  const evening = new Date("2026-11-13T23:00:00Z");
  const tomorrow = new Date("2026-11-14T11:00:00Z");

  it("primeira vez no dia anima; depois de marcar, não anima mais no mesmo dia", () => {
    const storage = memoryStorage();
    expect(isFirstTimeToday(storage, "meta", morning)).toBe(true);
    markSeenToday(storage, "meta", morning);
    expect(storage.data.get(firstTimeTodayStorageKey("meta"))).toBe("2026-11-13");
    expect(isFirstTimeToday(storage, "meta", evening)).toBe(false);
  });

  it("volta a animar no dia seguinte", () => {
    const storage = memoryStorage();
    markSeenToday(storage, "meta", morning);
    resetFirstTimeTodayMemory();
    expect(isFirstTimeToday(storage, "meta", tomorrow)).toBe(true);
  });

  it("chaves são independentes", () => {
    const storage = memoryStorage();
    markSeenToday(storage, "meta", morning);
    expect(isFirstTimeToday(storage, "ranking", morning)).toBe(true);
  });

  it("sem storage (SSR) considera já visto", () => {
    expect(isFirstTimeToday(null, "meta", morning)).toBe(false);
    expect(isFirstTimeToday(undefined, "meta", morning)).toBe(false);
  });

  it("storage que lança na leitura considera já visto", () => {
    const broken = { getItem: () => { throw new Error("SecurityError"); }, setItem: () => {} };
    expect(isFirstTimeToday(broken, "meta", morning)).toBe(false);
  });

  it("storage que lança na escrita não quebra e a memória da sessão evita repetir", () => {
    const readOnly = { getItem: () => null, setItem: () => { throw new Error("QuotaExceededError"); } };
    expect(isFirstTimeToday(readOnly, "meta", morning)).toBe(true);
    expect(() => markSeenToday(readOnly, "meta", morning)).not.toThrow();
    expect(isFirstTimeToday(readOnly, "meta", evening)).toBe(false);
  });
});
