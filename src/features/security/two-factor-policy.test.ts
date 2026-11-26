import { describe, expect, it } from "vitest";

import {
  DISABLED_TWO_FACTOR_POLICY,
  evaluateTwoFactorRequirement,
  isRoleRequiredByTwoFactorPolicy,
  isTwoFactorSetupPath,
  nextTwoFactorPolicy,
  parseTwoFactorGraceDays,
  parseTwoFactorPolicy,
  serializeTwoFactorPolicy,
  twoFactorGraceDeadline,
  twoFactorGraceLabel,
  type TwoFactorPolicy,
} from "./two-factor-policy";

const team = (graceDays: number, since = "2026-11-26T15:00:00.000Z"): TwoFactorPolicy => ({ scope: "team", graceDays, since });

describe("política de 2FA da equipe", () => {
  it("lê e grava a política, e trata valor quebrado como desligado", () => {
    const policy = team(7);
    expect(parseTwoFactorPolicy(serializeTwoFactorPolicy(policy))).toEqual(policy);
    expect(parseTwoFactorPolicy(null)).toEqual(DISABLED_TWO_FACTOR_POLICY);
    expect(parseTwoFactorPolicy("{quebrado")).toEqual(DISABLED_TWO_FACTOR_POLICY);
    expect(parseTwoFactorPolicy(JSON.stringify({ scope: "team", graceDays: 31, since: policy.since }))).toEqual(DISABLED_TWO_FACTOR_POLICY);
    expect(parseTwoFactorPolicy(JSON.stringify({ scope: "team", graceDays: 3 }))).toEqual(DISABLED_TWO_FACTOR_POLICY);
  });

  it("aceita carência só de 0 a 30 dias inteiros", () => {
    expect(parseTwoFactorGraceDays("0")).toBe(0);
    expect(parseTwoFactorGraceDays("30")).toBe(30);
    expect(parseTwoFactorGraceDays("31")).toBeNull();
    expect(parseTwoFactorGraceDays("-1")).toBeNull();
    expect(parseTwoFactorGraceDays("2.5")).toBeNull();
    expect(parseTwoFactorGraceDays("")).toBeNull();
  });

  it("ligar marca o começo agora; ajustar com ela ligada mantém o começo; desligar limpa", () => {
    const now = new Date("2026-11-27T12:00:00.000Z");
    expect(nextTwoFactorPolicy(DISABLED_TWO_FACTOR_POLICY, { scope: "team", graceDays: 5 }, now).since).toBe(now.toISOString());
    expect(nextTwoFactorPolicy(team(7), { scope: "management", graceDays: 3 }, now)).toEqual({ scope: "management", graceDays: 3, since: team(7).since });
    expect(nextTwoFactorPolicy(team(7), { scope: "off", graceDays: 7 }, now).since).toBeNull();
  });

  it("toda a equipe inclui o corretor; só a gestão começa no supervisor", () => {
    expect(isRoleRequiredByTwoFactorPolicy("team", "broker")).toBe(true);
    expect(isRoleRequiredByTwoFactorPolicy("management", "broker")).toBe(false);
    expect(isRoleRequiredByTwoFactorPolicy("management", "supervisor")).toBe(true);
    expect(isRoleRequiredByTwoFactorPolicy("management", "director")).toBe(true);
    expect(isRoleRequiredByTwoFactorPolicy("off", "director")).toBe(false);
  });

  it("não exige de quem já tem 2FA ou chave de acesso, nem de papel fora da regra", () => {
    const now = new Date("2026-12-30T12:00:00.000Z");
    expect(evaluateTwoFactorRequirement({ policy: team(0), role: "broker", hasTwoFactor: true, hasPasskey: false, now }).state).toBe("free");
    expect(evaluateTwoFactorRequirement({ policy: team(0), role: "broker", hasTwoFactor: false, hasPasskey: true, now }).state).toBe("free");
    expect(evaluateTwoFactorRequirement({ policy: { ...team(0), scope: "management" }, role: "broker", hasTwoFactor: false, hasPasskey: false, now }).state).toBe("free");
    expect(evaluateTwoFactorRequirement({ policy: DISABLED_TWO_FACTOR_POLICY, role: "director", hasTwoFactor: false, hasPasskey: false, now }).state).toBe("free");
  });

  it("carência 0 bloqueia na hora", () => {
    const result = evaluateTwoFactorRequirement({ policy: team(0), role: "broker", hasTwoFactor: false, hasPasskey: false, now: new Date("2026-11-26T15:00:01.000Z") });
    expect(result.state).toBe("blocked");
  });

  it("durante a carência mostra quantos dias faltam e depois bloqueia", () => {
    // Ligada em 26/11 às 12h de Brasília, 3 dias: vale até o fim de 28/11 e bloqueia à meia-noite de 29/11 (03h UTC).
    const policy = team(3);
    const at = (iso: string) => evaluateTwoFactorRequirement({ policy, role: "broker", hasTwoFactor: false, hasPasskey: false, now: new Date(iso) });
    expect(at("2026-11-26T15:30:00.000Z")).toMatchObject({ state: "grace", daysLeft: 3 });
    expect(at("2026-11-28T20:00:00.000Z")).toMatchObject({ state: "grace", daysLeft: 1 });
    expect(at("2026-11-29T02:59:59.000Z")).toMatchObject({ state: "grace", daysLeft: 1 });
    expect(at("2026-11-29T03:00:00.000Z").state).toBe("blocked");
  });

  it("conta o dia pelo fuso de Brasília, não pelo UTC", () => {
    // 26/11 às 23h30 em Brasília já é 27/11 em UTC: o primeiro dia ainda é 26/11.
    const deadline = twoFactorGraceDeadline(new Date("2026-11-27T02:30:00.000Z"), 1);
    expect(deadline.toISOString()).toBe("2026-11-27T03:00:00.000Z");
    const result = evaluateTwoFactorRequirement({ policy: team(1, "2026-11-27T02:30:00.000Z"), role: "broker", hasTwoFactor: false, hasPasskey: false, now: new Date("2026-11-27T02:45:00.000Z") });
    expect(result).toMatchObject({ state: "grace", daysLeft: 1 });
  });

  it("quem entra depois da exigência ganha a carência a partir da entrada", () => {
    const result = evaluateTwoFactorRequirement({
      policy: team(2, "2026-11-01T15:00:00.000Z"),
      role: "broker",
      hasTwoFactor: false,
      hasPasskey: false,
      memberSince: "2026-11-26T15:00:00.000Z",
      now: new Date("2026-11-27T15:00:00.000Z"),
    });
    expect(result).toMatchObject({ state: "grace", daysLeft: 1 });
  });

  it("a tela de configurar o 2FA nunca trava", () => {
    expect(isTwoFactorSetupPath("/settings")).toBe(true);
    expect(isTwoFactorSetupPath("/settings?tab=seguranca")).toBe(true);
    expect(isTwoFactorSetupPath("/settings/resultado-plantao")).toBe(true);
    expect(isTwoFactorSetupPath("/settingsx")).toBe(false);
    expect(isTwoFactorSetupPath("/leads")).toBe(false);
  });

  it("texto do aviso sem travessão", () => {
    expect(twoFactorGraceLabel(1)).toBe("Hoje é o último dia para ativar.");
    expect(twoFactorGraceLabel(4)).toBe("Faltam 4 dias para ativar.");
  });
});
