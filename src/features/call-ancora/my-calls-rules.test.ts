import { describe, expect, it } from "vitest";

import { isLightRouteAllowed, resolveLightRoute } from "@/components/light/light-routes";
import { isManagerRouteAllowed } from "@/features/manager-scope/manager-routes";
import { resolveNavLocation } from "@/shared/navigation/nav-registry";

import {
  callResult,
  canSeeTeamCalls,
  effectiveCalls,
  formatCallDuration,
  formatTalkTotal,
  narrowCallerScope,
  normalizeMyCallsFilters,
  resolveCallerScope,
  summarizeMyCalls,
  type MyCallRow,
} from "./my-calls-rules";

function call(partial: Partial<MyCallRow> & Pick<MyCallRow, "id" | "at">): MyCallRow {
  return {
    brokerId: "b1",
    brokerName: "Ana",
    leadId: "l1",
    leadName: "Lead 1",
    phoneMasked: "(21) •••••-1234",
    outcome: "no_answer",
    talkSeconds: 0,
    correction: false,
    ...partial,
  };
}

describe("Minhas ligações: escopo", () => {
  it("corretor vê só as próprias, mesmo com equipe ou filtro na URL", () => {
    expect(resolveCallerScope({ role: "broker", userId: "u1", teamIds: ["x"], tenantWide: true })).toEqual({ kind: "users", userIds: ["u1"] });
    expect(normalizeMyCallsFilters("broker", { corretor: "outro" }).brokerId).toBeNull();
    expect(canSeeTeamCalls("broker")).toBe(false);
  });

  it("supervisor e gestor veem a equipe ou unidade e as próprias; diretor vê a empresa", () => {
    expect(resolveCallerScope({ role: "supervisor", userId: "s1", teamIds: ["b1", "b2", "b1"] })).toEqual({ kind: "users", userIds: ["s1", "b1", "b2"] });
    expect(resolveCallerScope({ role: "manager", userId: "m1", teamIds: [] })).toEqual({ kind: "users", userIds: ["m1"] });
    expect(resolveCallerScope({ role: "director", userId: "d1" })).toEqual({ kind: "tenant" });
  });

  it("papel desconhecido nunca ganha a empresa", () => {
    expect(resolveCallerScope({ role: "viewer", userId: "v1", tenantWide: true })).toEqual({ kind: "users", userIds: ["v1"] });
  });

  it("filtro por corretor só estreita dentro do escopo", () => {
    const team = resolveCallerScope({ role: "supervisor", userId: "s1", teamIds: ["b1"] });
    expect(narrowCallerScope(team, "b1")).toEqual({ kind: "users", userIds: ["b1"] });
    expect(narrowCallerScope(team, "fora")).toEqual(team);
    expect(narrowCallerScope({ kind: "tenant" }, "b9")).toEqual({ kind: "users", userIds: ["b9"] });
    expect(narrowCallerScope(team, null)).toEqual(team);
  });

  it("período padrão de 7 dias e só os períodos conhecidos", () => {
    expect(normalizeMyCallsFilters("director", {})).toEqual({ period: "7d", brokerId: null });
    expect(normalizeMyCallsFilters("director", { periodo: "today", corretor: "b1" })).toEqual({ period: "today", brokerId: "b1" });
    expect(normalizeMyCallsFilters("manager", { periodo: "90d" }).period).toBe("7d");
  });
});

describe("Minhas ligações: agregação", () => {
  it("correção troca o resultado da ligação anterior e não conta outra ligação", () => {
    const rows = [
      call({ id: "c1", at: "2026-11-26T12:00:00.000Z", outcome: "no_answer", talkSeconds: 40 }),
      call({ id: "c2", at: "2026-11-26T12:01:00.000Z", outcome: "interested", correction: true }),
      call({ id: "c3", at: "2026-11-26T13:00:00.000Z", leadId: "l2", outcome: "voicemail" }),
    ];
    const effective = effectiveCalls(rows);
    expect(effective.map((row) => row.id)).toEqual(["c3", "c1"]);
    expect(effective[1]).toMatchObject({ outcome: "interested", talkSeconds: 40 });
    expect(summarizeMyCalls(effective)).toEqual({ calls: 2, answered: 1, talkSeconds: 40 });
  });

  it("correção sem ligação anterior conta como ligação", () => {
    const effective = effectiveCalls([call({ id: "c1", at: "2026-11-26T12:00:00.000Z", correction: true, outcome: "wrong_number" })]);
    expect(effective).toHaveLength(1);
    expect(effective[0].correction).toBe(false);
  });

  it("correção de outro corretor não mexe na ligação de quem ligou", () => {
    const effective = effectiveCalls([
      call({ id: "c1", at: "2026-11-26T12:00:00.000Z", brokerId: "b1" }),
      call({ id: "c2", at: "2026-11-26T12:05:00.000Z", brokerId: "b2", correction: true, outcome: "interested" }),
    ]);
    expect(effective).toHaveLength(2);
    expect(effective.find((row) => row.id === "c1")?.outcome).toBe("no_answer");
  });

  it("resumo vazio e duração negativa não somam", () => {
    expect(summarizeMyCalls([])).toEqual({ calls: 0, answered: 0, talkSeconds: 0 });
    expect(summarizeMyCalls([call({ id: "c1", at: "x", talkSeconds: -5 })]).talkSeconds).toBe(0);
  });

  it("resultado: atendeu, não atendeu, caixa postal e número errado", () => {
    expect(callResult({ outcome: "interested", talkSeconds: 0 })).toMatchObject({ key: "answered", detail: "Com interesse" });
    expect(callResult({ outcome: "not_interested", talkSeconds: 30 })).toMatchObject({ key: "answered", detail: "Sem interesse" });
    expect(callResult({ outcome: "no_answer", talkSeconds: 0 })).toMatchObject({ key: "no_answer", label: "Não atendeu" });
    expect(callResult({ outcome: "no_answer", talkSeconds: 12 }).key).toBe("answered");
    expect(callResult({ outcome: "voicemail", talkSeconds: 0 }).label).toBe("Caixa postal");
    expect(callResult({ outcome: "wrong_number", talkSeconds: 5 }).label).toBe("Número errado");
  });

  it("formata duração e tempo total sem travessão", () => {
    expect(formatCallDuration(0)).toBeNull();
    expect(formatCallDuration(42)).toBe("0:42");
    expect(formatCallDuration(725)).toBe("12:05");
    expect(formatTalkTotal(45)).toBe("45 s");
    expect(formatTalkTotal(12 * 60 + 30)).toBe("12 min");
    expect(formatTalkTotal(65 * 60)).toBe("1 h 05 min");
  });
});

describe("Minhas ligações: rota", () => {
  it("é a aba Ligações da área Leads e abre para supervisor, corretor e gestor", () => {
    expect(resolveNavLocation("/tarefas/ligacoes")).toMatchObject({ area: { id: "leads" }, tab: { id: "ligacoes" } });
    expect(resolveNavLocation("/tarefas")?.tab.id).toBe("tarefas");
    expect(isLightRouteAllowed("/tarefas/ligacoes")).toBe(true);
    expect(isLightRouteAllowed("/tarefas/ligacoes", "supervisor")).toBe(true);
    expect(resolveLightRoute("/tarefas/ligacoes")).toMatchObject({ title: "Ligações", parentHref: "/tarefas" });
    expect(isManagerRouteAllowed("/tarefas/ligacoes")).toBe(true);
  });
});
