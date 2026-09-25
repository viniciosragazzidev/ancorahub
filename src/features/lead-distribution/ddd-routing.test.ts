import { describe, expect, it } from "vitest";
import { BRAZIL_DDDS_BY_STATE, decideDddRouting, extractBrazilianDdd, normalizeDddRoutingSettings } from "./ddd-routing";

describe("BRAZIL_DDDS_BY_STATE", () => {
  it("lists the 67 Brazilian DDDs once each, across the 27 states", () => {
    const all = BRAZIL_DDDS_BY_STATE.flatMap((state) => state.ddds);
    expect(BRAZIL_DDDS_BY_STATE).toHaveLength(27);
    expect(all).toHaveLength(67);
    expect(new Set(all).size).toBe(67);
  });
});

describe("extractBrazilianDdd", () => {
  it("reads the DDD with or without +55, formatted or not, 8 or 9 digits", () => {
    expect(extractBrazilianDdd("+55 (21) 99942-8504")).toBe("21");
    expect(extractBrazilianDdd("5511999998888")).toBe("11");
    expect(extractBrazilianDdd("552133428504")).toBe("21");
    expect(extractBrazilianDdd("(31) 3333-4444")).toBe("31");
    expect(extractBrazilianDdd("021 99942-8504")).toBe("21");
  });

  it("returns null for missing, foreign, malformed or non-existent area codes", () => {
    expect(extractBrazilianDdd(null)).toBeNull();
    expect(extractBrazilianDdd("99942-8504")).toBeNull();
    expect(extractBrazilianDdd("+1 415 555 2671")).toBeNull();
    expect(extractBrazilianDdd("(20) 99942-8504")).toBeNull();
  });
});

describe("decideDddRouting", () => {
  const settings = normalizeDddRoutingSettings({
    enabled: true,
    validDdds: ["21", "22", "24"],
    queues: { valid: "fila-rj", invalid: "fila-fora", unknown: null },
  });

  it("sends each situation to its configured queue", () => {
    expect(decideDddRouting(settings, "+5521999428504")).toMatchObject({ outcome: "valid", ddd: "21", queueId: "fila-rj" });
    expect(decideDddRouting(settings, "+5511999998888")).toMatchObject({ outcome: "invalid", ddd: "11", queueId: "fila-fora" });
  });

  it("keeps the normal flow (null queue) for a situation with no queue configured", () => {
    expect(decideDddRouting(settings, "99942-8504")).toMatchObject({ outcome: "unknown", ddd: null, queueId: null });
  });

  it("does nothing while the rule is off", () => {
    expect(decideDddRouting({ ...settings, enabled: false }, "+5511999998888")).toBeNull();
  });
});

describe("normalizeDddRoutingSettings", () => {
  it("drops unknown DDDs and blank queues, and defaults to off", () => {
    expect(normalizeDddRoutingSettings({ validDdds: ["21", "20", "21", "11"], queues: { valid: "  ", invalid: "q1" } })).toEqual({
      enabled: false,
      validDdds: ["11", "21"],
      queues: { valid: null, invalid: "q1", unknown: null },
    });
    expect(normalizeDddRoutingSettings("garbage").enabled).toBe(false);
  });
});
