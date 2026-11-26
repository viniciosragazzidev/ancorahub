import { describe, expect, it } from "vitest";

import {
  countLgpdAttention,
  describeLgpdDeadline,
  describeLgpdSituation,
  lgpdDaysUntilDue,
  lgpdRequestDueAt,
  pickOpenLgpdRequest,
  sortLgpdRequests,
  validateRegisterLgpdRequest,
} from "./lgpd-requests";

// 26/11/2026 10h em Brasília.
const NOW = new Date("2026-11-26T13:00:00.000Z");
const at = (iso: string) => new Date(iso);

describe("prazo de 15 dias corridos", () => {
  it("vence 15 dias depois do pedido, contando fim de semana", () => {
    expect(lgpdRequestDueAt(at("2026-11-10T15:00:00.000Z")).toISOString()).toBe("2026-11-25T15:00:00.000Z");
    // Pedido às 23h de 10/11 em Brasília (02h UTC de 11/11) vence em 25/11 no calendário de Brasília.
    expect(lgpdDaysUntilDue(lgpdRequestDueAt(at("2026-11-11T02:00:00.000Z")), at("2026-11-25T12:00:00.000Z"))).toBe(0);
  });

  it("conta dias do calendário de Brasília, não blocos de 24 horas", () => {
    // Prazo às 08h de 27/11; agora 23h de 26/11: falta 1 dia, mesmo com só 9 horas.
    expect(lgpdDaysUntilDue(at("2026-11-27T11:00:00.000Z"), at("2026-11-27T02:00:00.000Z"))).toBe(1);
  });

  it("texto do prazo em aberto", () => {
    expect(describeLgpdDeadline({ dueAt: at("2026-12-06T13:00:00.000Z"), completedAt: null }, NOW)).toEqual({ label: "Vence em 10 dias", tone: null });
    expect(describeLgpdDeadline({ dueAt: at("2026-11-29T13:00:00.000Z"), completedAt: null }, NOW)).toEqual({ label: "Vence em 3 dias", tone: "warning" });
    expect(describeLgpdDeadline({ dueAt: at("2026-11-27T13:00:00.000Z"), completedAt: null }, NOW)).toEqual({ label: "Vence em 1 dia", tone: "warning" });
    expect(describeLgpdDeadline({ dueAt: at("2026-11-26T23:00:00.000Z"), completedAt: null }, NOW)).toEqual({ label: "Vence hoje", tone: "danger" });
    expect(describeLgpdDeadline({ dueAt: at("2026-11-25T13:00:00.000Z"), completedAt: null }, NOW)).toEqual({ label: "Vencido há 1 dia", tone: "danger" });
    expect(describeLgpdDeadline({ dueAt: at("2026-11-20T13:00:00.000Z"), completedAt: null }, NOW)).toEqual({ label: "Vencido há 6 dias", tone: "danger" });
  });

  it("atendido até o fim do dia do prazo conta como no prazo", () => {
    const dueAt = at("2026-11-25T11:00:00.000Z");
    expect(describeLgpdDeadline({ dueAt, completedAt: at("2026-11-26T01:00:00.000Z") }, NOW)).toEqual({ label: "Atendido no prazo", tone: "success" });
    expect(describeLgpdDeadline({ dueAt, completedAt: at("2026-11-26T12:00:00.000Z") }, NOW)).toEqual({ label: "Atendido fora do prazo", tone: "warning" });
  });

  it("situação", () => {
    expect(describeLgpdSituation({ dueAt: at("2026-12-01T13:00:00.000Z"), completedAt: null }, NOW)).toEqual({ label: "Em aberto", tone: null });
    expect(describeLgpdSituation({ dueAt: at("2026-11-20T13:00:00.000Z"), completedAt: null }, NOW)).toEqual({ label: "Em aberto, vencido", tone: "danger" });
    expect(describeLgpdSituation({ dueAt: at("2026-11-20T13:00:00.000Z"), completedAt: NOW }, NOW)).toEqual({ label: "Atendido", tone: "success" });
  });
});

describe("lista de pedidos", () => {
  const rows = [
    { id: "feito-antigo", dueAt: at("2026-11-10T00:00:00Z"), completedAt: at("2026-11-02T00:00:00Z") },
    { id: "aberto-depois", dueAt: at("2026-12-05T00:00:00Z"), completedAt: null },
    { id: "feito-recente", dueAt: at("2026-11-30T00:00:00Z"), completedAt: at("2026-11-20T00:00:00Z") },
    { id: "aberto-vencido", dueAt: at("2026-11-20T00:00:00Z"), completedAt: null },
    { id: "aberto-logo", dueAt: at("2026-11-28T13:00:00Z"), completedAt: null },
  ];

  it("abertos primeiro pelo prazo, depois atendidos mais recentes", () => {
    expect(sortLgpdRequests(rows).map((row) => row.id)).toEqual(["aberto-vencido", "aberto-logo", "aberto-depois", "feito-recente", "feito-antigo"]);
  });

  it("conta vencidos e os que vencem em até 3 dias", () => {
    expect(countLgpdAttention(rows, NOW)).toEqual({ overdue: 1, soon: 1 });
  });

  it("o atendimento na ficha conclui o pedido aberto mais antigo do tipo", () => {
    const requests = [
      { id: "b", kind: "export", requestedAt: at("2026-11-20T00:00:00Z"), completedAt: null },
      { id: "a", kind: "export", requestedAt: at("2026-11-10T00:00:00Z"), completedAt: null },
      { id: "c", kind: "anonymize", requestedAt: at("2026-11-01T00:00:00Z"), completedAt: null },
      { id: "d", kind: "export", requestedAt: at("2026-11-01T00:00:00Z"), completedAt: at("2026-11-02T00:00:00Z") },
    ];
    expect(pickOpenLgpdRequest(requests, "export")?.id).toBe("a");
    expect(pickOpenLgpdRequest(requests, "anonymize")?.id).toBe("c");
    expect(pickOpenLgpdRequest(requests.slice(3), "export")).toBeNull();
  });
});

describe("registrar pedido que chegou por fora", () => {
  const base = { leadId: "lead-1", kind: "anonymize", reason: "E-mail do titular", requestedOn: "2026-11-20" };

  it("pedido de outro dia: meio-dia de Brasília e prazo 15 dias depois", () => {
    const result = validateRegisterLgpdRequest(base, NOW);
    expect(result).toMatchObject({ ok: true, leadId: "lead-1", kind: "anonymize", reason: "E-mail do titular" });
    if (!result.ok) throw new Error("esperava ok");
    expect(result.requestedAt.toISOString()).toBe("2026-11-20T15:00:00.000Z");
    expect(result.dueAt.toISOString()).toBe("2026-12-05T15:00:00.000Z");
  });

  it("pedido de hoje usa a hora atual", () => {
    const result = validateRegisterLgpdRequest({ ...base, requestedOn: "2026-11-26" }, NOW);
    if (!result.ok) throw new Error("esperava ok");
    expect(result.requestedAt).toEqual(NOW);
  });

  it("recusa o que falta ou está fora da regra", () => {
    expect(validateRegisterLgpdRequest({ ...base, leadId: " " }, NOW)).toEqual({ ok: false, error: "Escolha o lead do titular." });
    expect(validateRegisterLgpdRequest({ ...base, kind: "delete" }, NOW)).toEqual({ ok: false, error: "Escolha o tipo do pedido." });
    expect(validateRegisterLgpdRequest({ ...base, reason: "oi" }, NOW)).toEqual({ ok: false, error: "Escreva como o pedido chegou." });
    expect(validateRegisterLgpdRequest({ ...base, requestedOn: "20/11/2026" }, NOW)).toEqual({ ok: false, error: "Informe o dia do pedido." });
    expect(validateRegisterLgpdRequest({ ...base, requestedOn: "2026-11-27" }, NOW)).toEqual({ ok: false, error: "O dia do pedido não pode ser no futuro." });
    expect(validateRegisterLgpdRequest({ ...base, requestedOn: "2025-11-25" }, NOW)).toEqual({ ok: false, error: "O dia do pedido pode ser de até um ano atrás." });
  });
});
