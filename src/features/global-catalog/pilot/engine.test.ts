import { describe, expect, it } from "vitest";
import { canUsePilot, pilotConfigSchema, quoteInputSchema, type CatalogPlan, type Price } from "./contracts";
import { activeAt, priceLives, selectPrice, simulate } from "./engine";

const id = "004b3e1a-349c-4ee3-8fec-fd9d90de646c";
const price: Price = { id: "p1", cents: 30193, min: 0, max: null, active: true, from: "2026-01-01", to: "2026-12-31", priority: 0, lives: 1 };
const plan: CatalogPlan = { id, name: "Produto real", code: "A", operator: "Operadora", operatorId: "o", administrator: "", modality: "PESSOA_FISICA", accommodation: "Apartamento", coparticipation: "Sem", coverage: "NACIONAL", entity: "", cities: ["Rio de Janeiro"], businessProfiles: [], dental: null, minAge: 0, maxAge: null, holderMin: 18, holderMax: null, dependentMin: 0, dependentMax: null, minLives: 1, maxLives: null, minHolders: 1, ageConfirmed: true, eligibilityConfirmed: true, businessConfirmed: false, from: "2026-01-01", to: null, prices: [price], networkCount: 10, detailCount: 3 };
const input = quoteInputSchema.parse({ modality: "PESSOA_FISICA", city: "Rio de Janeiro", lives: [{ age: 39, holder: true }] });
const date = "2026-11-11";
function quote(p: CatalogPlan = plan, overrides: Partial<typeof input> = {}, reviewed = true) { return simulate([p], { ...input, ...overrides }, date, new Set(reviewed ? [p.id] : []), new Set(), "release"); }

describe("real catalog pricing and eligibility", () => {
  it("adds integer cents per life without discounts or summing alternatives", () => {
    const result = simulate([plan, { ...plan, id: "alternative" }], { ...input, lives: [...input.lives, { age: 8, holder: false, relationship: "Filho(a)" }] }, date, new Set([id]), new Set(), "r");
    expect(result.results.map(p => p.totalCents)).toEqual([60386, 60386]);
  });
  it("includes date boundaries and rejects expired or future prices", () => {
    expect(activeAt(date, date, date)).toBe(true);
    expect(selectPrice([{ ...price, to: "2026-11-10" }, { ...price, from: "2026-11-12" }], 39, date).price).toBeNull();
  });
  it("selects priority, then newest start, and reports conflicting ties", () => {
    const result = selectPrice([price, { ...price, id: "p2", cents: 100, priority: 100 }, { ...price, id: "p3", cents: 200, priority: 100, from: "2026-02-01" }, { ...price, id: "p4", cents: 300, priority: 100, from: "2026-02-01" }], 39, date);
    expect(result.price?.id).toBe("p3"); expect(result.ambiguous).toBe(true);
  });
  it("keeps 59+ open and uses 18/19 boundaries exactly", () => {
    const prices = [{ ...price, id: "child", min: 0, max: 18 }, { ...price, id: "adult", min: 19, max: 58 }, { ...price, id: "senior", min: 59, max: null }];
    expect([18, 19, 58, 59, 99].map(age => selectPrice(prices, age, date).price?.id)).toEqual(["child", "adult", "adult", "senior", "senior"]);
  });
  it("does not price a group with a missing age band or inactive/zero value", () => {
    expect(priceLives({ ...plan, prices: [{ ...price, max: 18 }] }, input.lives, date)).toBeNull();
    expect(priceLives({ ...plan, prices: [{ ...price, active: false }, { ...price, cents: 0 }] }, input.lives, date)).toBeNull();
  });
  it("requires an explicit holder and never treats blank age as zero", () => {
    expect(quoteInputSchema.safeParse({ ...input, lives: [{ age: "", holder: true }] }).success).toBe(false);
    expect(quoteInputSchema.safeParse({ ...input, lives: [{ age: 39, holder: false }] }).success).toBe(false);
    expect(quoteInputSchema.safeParse({ ...input, lives: [{ age: 39, holder: true }, { age: 35, holder: true }] }).success).toBe(false);
  });
  it("blocks unreviewed commercial products and preserves their prices", () => {
    expect(quote(plan, {}, false).results[0]).toMatchObject({ totalCents: 30193, state: "pending" });
    expect(quote().results[0].state).toBe("ready");
  });
  it("an admin product review cannot erase unknown source rules", () => {
    expect(quote({ ...plan, ageConfirmed: false }).results[0].state).toBe("pending");
    expect(quote({ ...plan, minLives: 3, eligibilityConfirmed: false }).results[0].state).toBe("pending");
  });
  it("excludes incompatible confirmed lives and cities by default", () => {
    expect(quote({ ...plan, minLives: 3 }).total).toBe(0);
    expect(quote(plan, { city: "Niterói" }).incompatible).toBe(1);
    expect(quote(plan, { city: "Niterói", includeIncompatible: true }).results[0].state).toBe("incompatible");
  });
  it("keeps adhesion and ambiguous prices pending even after catalog review", () => {
    expect(quote({ ...plan, modality: "ADESAO" }, { modality: "ADESAO", profession: "Advogado" }).results[0].state).toBe("pending");
    expect(quote({ ...plan, prices: [price, { ...price, id: "p2", cents: 100 }] }).results[0].state).toBe("pending");
  });
  it("does not expose hidden products and applies budget against the whole group", () => {
    expect(simulate([plan], input, date, new Set([id]), new Set([id]), "r").total).toBe(0);
    expect(quote(plan, { budgetCents: 30192 }).total).toBe(0);
    expect(quote(plan, { budgetCents: 30193 }).total).toBe(1);
  });
  it("paginates deterministically across 24 rows without duplicates", () => {
    const plans = Array.from({ length: 49 }, (_, i) => ({ ...plan, id: `p${i}` }));
    const pages = [1, 2, 3].map(page => simulate(plans, { ...input, page }, date, new Set(), new Set(), "r"));
    expect(pages.map(p => p.results.length)).toEqual([24, 24, 1]);
    expect(new Set(pages.flatMap(p => p.results.map(r => r.id))).size).toBe(49);
  });
});

describe("exclusive broker pilot", () => {
  const config = pilotConfigSchema.parse({ enabled: true, userId: "ebed87f7-b4f3-41c1-8e92-d234fa5a1ce1", tenantId: "d47a4d41-4e45-450d-a0b8-a9e1be286903", release: "cotadorfm-2026-11-11-123456abcdef", indexHash: "a".repeat(64) });
  const context = { userId: config.userId, tenantId: config.tenantId, role: "broker" };
  it("allows exactly the configured broker and active tenant", () => expect(canUsePilot(context, config)).toBe(true));
  it.each([{ userId: "another" }, { tenantId: "another" }, { role: "director" }, { role: "manager" }, { role: "supervisor" }])("denies altered identity or role %o", override => expect(canUsePilot({ ...context, ...override }, config)).toBe(false));
  it("fails closed when absent or switched off", () => { expect(canUsePilot(context, null)).toBe(false); expect(canUsePilot(context, { ...config, enabled: false })).toBe(false); });
});
