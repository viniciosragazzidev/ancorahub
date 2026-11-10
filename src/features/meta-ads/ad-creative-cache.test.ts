import { describe, expect, it, vi } from "vitest";

vi.mock("@/shared/db", () => ({ getDatabase: vi.fn(), schema: {} }));
vi.mock("./meta-oauth", () => ({ decryptMetaToken: vi.fn() }));

import { AD_CREATIVE_TTL_MS, shouldRefreshAdCreative } from "./ad-creative-cache";

const now = new Date("2026-11-10T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);
const DAY = 24 * 60 * 60 * 1000;

describe("quando ler o criativo de novo na Meta", () => {
  it("nunca lido ou só com o referral do WhatsApp: lê", () => {
    expect(shouldRefreshAdCreative(null, now)).toBe(true);
    expect(shouldRefreshAdCreative({ fetchedAt: null, fetchAttempts: 0, source: "referral" }, now)).toBe(true);
  });

  it("lido há menos de 24 h: não lê; depois disso a imagem pode ter vencido", () => {
    expect(shouldRefreshAdCreative({ fetchedAt: ago(AD_CREATIVE_TTL_MS - 1000), fetchAttempts: 0, source: "graph" }, now)).toBe(false);
    expect(shouldRefreshAdCreative({ fetchedAt: ago(AD_CREATIVE_TTL_MS + 1000), fetchAttempts: 0, source: "graph" }, now)).toBe(true);
  });

  it("três falhas seguidas: pausa por 7 dias", () => {
    expect(shouldRefreshAdCreative({ fetchedAt: ago(2 * DAY), fetchAttempts: 3, source: "graph" }, now)).toBe(false);
    expect(shouldRefreshAdCreative({ fetchedAt: ago(8 * DAY), fetchAttempts: 3, source: "graph" }, now)).toBe(true);
    expect(shouldRefreshAdCreative({ fetchedAt: null, fetchAttempts: 3, source: "graph" }, now)).toBe(false);
  });
});
