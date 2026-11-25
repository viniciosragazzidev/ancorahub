import { describe, expect, it } from "vitest";

import { allocateAutoRuleQuotas, AUTO_RULE_LIMITS, parseTenantAutoDailyLimit, postSaleAutoDailyLimitKey, tenantAutoDailyLimitInputSchema } from "./auto-rules";

const asObject = (quotas: Map<string, number>) => Object.fromEntries(quotas);

describe("divisão das vagas do dia entre as regras (25/11)", () => {
  it("a R1 não ocupa mais o limite inteiro: cada regra com gente ganha uma parte igual", () => {
    expect(asObject(allocateAutoRuleQuotas(150, [
      { key: "R1", wanted: 300 }, { key: "R2", wanted: 300 }, { key: "R3", wanted: 300 },
    ]))).toEqual({ R1: 50, R2: 50, R3: 50 });
  });

  it("o que uma regra não usa vai para as outras", () => {
    expect(asObject(allocateAutoRuleQuotas(150, [
      { key: "R1", wanted: 200 }, { key: "R2", wanted: 10 }, { key: "R3", wanted: 4 }, { key: "R4", wanted: 0 },
    ]))).toEqual({ R1: 136, R2: 10, R3: 4, R4: 0 });
  });

  it("o resto da divisão fica com as primeiras regras, e nunca passa das vagas", () => {
    const quotas = allocateAutoRuleQuotas(10, [{ key: "R1", wanted: 9 }, { key: "R2", wanted: 9 }, { key: "R4", wanted: 9 }]);
    expect(asObject(quotas)).toEqual({ R1: 4, R2: 3, R4: 3 });
    expect([...quotas.values()].reduce((a, b) => a + b, 0)).toBe(10);
  });

  it("menos vagas que regras: uma para cada, na ordem", () => {
    expect(asObject(allocateAutoRuleQuotas(2, [{ key: "R1", wanted: 5 }, { key: "R2", wanted: 5 }, { key: "R3", wanted: 5 }]))).toEqual({ R1: 1, R2: 1, R3: 0 });
  });

  it("sem vagas ou sem gente, ninguém recebe", () => {
    expect(asObject(allocateAutoRuleQuotas(0, [{ key: "R1", wanted: 5 }]))).toEqual({ R1: 0 });
    expect(asObject(allocateAutoRuleQuotas(-3, [{ key: "R1", wanted: 5 }]))).toEqual({ R1: 0 });
    expect(asObject(allocateAutoRuleQuotas(50, [{ key: "R1", wanted: 0 }]))).toEqual({ R1: 0 });
  });

  it("todo mundo cabe: cada regra recebe o que quer", () => {
    expect(asObject(allocateAutoRuleQuotas(150, [{ key: "R1", wanted: 60 }, { key: "R2", wanted: 30 }]))).toEqual({ R1: 60, R2: 30 });
  });
});

describe("limite da empresa por dia (25/11)", () => {
  it("padrão de 150, guardado por empresa", () => {
    expect(AUTO_RULE_LIMITS.tenantDailyLimit).toBe(150);
    expect(parseTenantAutoDailyLimit(null)).toBe(150);
    expect(parseTenantAutoDailyLimit("abc")).toBe(150);
    expect(parseTenantAutoDailyLimit("0")).toBe(150);
    expect(parseTenantAutoDailyLimit("220")).toBe(220);
    expect(parseTenantAutoDailyLimit("9999")).toBe(AUTO_RULE_LIMITS.tenantDailyLimitMax);
    expect(postSaleAutoDailyLimitKey("t1")).toBe("post_sale_auto_daily_limit_t1");
  });

  it("o diretor escolhe de 1 até o teto", () => {
    expect(tenantAutoDailyLimitInputSchema.safeParse({ limit: 200 }).success).toBe(true);
    expect(tenantAutoDailyLimitInputSchema.safeParse({ limit: 0 }).success).toBe(false);
    expect(tenantAutoDailyLimitInputSchema.safeParse({ limit: AUTO_RULE_LIMITS.tenantDailyLimitMax + 1 }).success).toBe(false);
    expect(tenantAutoDailyLimitInputSchema.safeParse({ limit: 10.5 }).success).toBe(false);
  });
});
