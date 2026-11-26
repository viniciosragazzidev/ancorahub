import { describe, expect, it } from "vitest";

import {
  DEFAULT_POST_SALE_SEQUENCE,
  planPostSaleSequence,
  postSaleSequenceDueAt,
  postSaleSequenceTaskId,
  resolvePostSaleSequenceSettings,
  serializePostSaleSequenceSettings,
  validatePostSaleSequenceInput,
} from "./post-sale-sequence-core";

const lead = { id: "lead-1", status: "converted", corretorId: "broker-1" };
// Quinta, 26/11/2026, 12h em São Paulo.
const convertedAt = new Date("2026-11-26T15:00:00.000Z");

describe("agenda da sequência de pós-venda", () => {
  it("cria D+1, D+15 e D+30 às 9h de São Paulo", () => {
    const plan = planPostSaleSequence({ settings: DEFAULT_POST_SALE_SEQUENCE, lead, existingTaskIds: [], convertedAt });
    expect(plan.kind).toBe("create");
    if (plan.kind !== "create") return;
    expect(plan.tasks.map((task) => [task.id, task.title, task.dueAt.toISOString()])).toEqual([
      ["pos-venda:lead-1:boas-vindas", "Boas-vindas ao cliente", "2026-11-27T12:00:00.000Z"],
      ["pos-venda:lead-1:implantacao", "Confirmar implantação e carteirinha", "2026-12-11T12:00:00.000Z"],
      ["pos-venda:lead-1:satisfacao", "Pesquisa de satisfação", "2026-12-26T12:00:00.000Z"],
    ]);
  });

  it("domingo vira segunda", () => {
    // Sábado 28/11: D+1 cai no domingo 29 e vai para segunda 30.
    expect(postSaleSequenceDueAt(1, new Date("2026-11-28T15:00:00.000Z")).toISOString()).toBe("2026-11-30T12:00:00.000Z");
  });

  it("conta os dias pelo dia de São Paulo, não pelo UTC", () => {
    // 23h30 de 26/11 em São Paulo já é 27/11 em UTC.
    expect(postSaleSequenceDueAt(1, new Date("2026-11-27T02:30:00.000Z")).toISOString()).toBe("2026-11-27T12:00:00.000Z");
  });
});

describe("idempotência por lead", () => {
  it("não repete quando a sequência já começou, mesmo se o corretor apagou um passo", () => {
    const plan = planPostSaleSequence({ settings: DEFAULT_POST_SALE_SEQUENCE, lead, existingTaskIds: [postSaleSequenceTaskId("lead-1", "satisfacao")], convertedAt });
    expect(plan).toEqual({ kind: "skip", reason: "ja_criada" });
  });

  it("ids fixos por lead e passo: a mesma conversão gera os mesmos ids", () => {
    const first = planPostSaleSequence({ settings: DEFAULT_POST_SALE_SEQUENCE, lead, existingTaskIds: [], convertedAt });
    const again = planPostSaleSequence({ settings: DEFAULT_POST_SALE_SEQUENCE, lead, existingTaskIds: [], convertedAt: new Date("2026-12-20T15:00:00.000Z") });
    expect(first.kind === "create" && again.kind === "create" && first.tasks.map((t) => t.id)).toEqual(again.kind === "create" ? again.tasks.map((t) => t.id) : null);
  });

  it("ignora tarefas de outros leads", () => {
    const plan = planPostSaleSequence({ settings: DEFAULT_POST_SALE_SEQUENCE, lead, existingTaskIds: ["pos-venda:lead-10:boas-vindas"], convertedAt });
    expect(plan.kind).toBe("create");
  });

  it("pula desligada, sem corretor e lead que não está mais Convertido", () => {
    expect(planPostSaleSequence({ settings: { ...DEFAULT_POST_SALE_SEQUENCE, enabled: false }, lead, existingTaskIds: [], convertedAt })).toEqual({ kind: "skip", reason: "desligada" });
    expect(planPostSaleSequence({ settings: DEFAULT_POST_SALE_SEQUENCE, lead: { ...lead, corretorId: null }, existingTaskIds: [], convertedAt })).toEqual({ kind: "skip", reason: "sem_corretor" });
    expect(planPostSaleSequence({ settings: DEFAULT_POST_SALE_SEQUENCE, lead: { ...lead, status: "lost" }, existingTaskIds: [], convertedAt })).toEqual({ kind: "skip", reason: "nao_convertido" });
  });
});

describe("configuração da sequência", () => {
  it("padrão ligado com os 3 passos quando não há nada salvo ou o JSON é inválido", () => {
    expect(resolvePostSaleSequenceSettings(null)).toEqual(DEFAULT_POST_SALE_SEQUENCE);
    expect(resolvePostSaleSequenceSettings("{quebrado")).toEqual(DEFAULT_POST_SALE_SEQUENCE);
  });

  it("guarda e lê de volta dias, títulos e o desligado", () => {
    const result = validatePostSaleSequenceInput({
      enabled: null,
      steps: [
        { id: "boas-vindas", days: "2", title: "  Ligar   de boas-vindas " },
        { id: "implantacao", days: "20", title: "Conferir carteirinha" },
        { id: "satisfacao", days: "45", title: "Pesquisa" },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.settings.enabled).toBe(false);
    expect(result.settings.steps[0]).toEqual({ id: "boas-vindas", days: 2, title: "Ligar de boas-vindas" });
    expect(resolvePostSaleSequenceSettings(serializePostSaleSequenceSettings(result.settings))).toEqual(result.settings);
  });

  it("recusa dias fora de 1 a 365 e título curto", () => {
    const base = DEFAULT_POST_SALE_SEQUENCE.steps.map((step) => ({ id: step.id, days: String(step.days), title: step.title }));
    expect(validatePostSaleSequenceInput({ enabled: "true", steps: base.map((step, index) => index === 1 ? { ...step, days: "0" } : step) })).toEqual({ ok: false, error: "Passo 2: informe de 1 a 365 dias." });
    expect(validatePostSaleSequenceInput({ enabled: "true", steps: base.map((step, index) => index === 2 ? { ...step, title: "a" } : step) }).ok).toBe(false);
  });
});
