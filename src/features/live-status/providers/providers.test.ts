import { describe, expect, it } from "vitest";

import { buildAiQualificationStatus } from "./ai-qualification";
import { buildColdLeadsStatus } from "./cold-leads";
import { buildColdReleaseStatus, nextColdReleaseAt } from "./cold-release";
import { buildDistributionEngineSeal } from "./distribution-engine";
import { buildDutyStatus } from "./duty";
import { buildFirstContactStatus } from "./first-contact";
import { buildOffersStatus } from "./offers";
import { buildWaitingBrokerStatus } from "./waiting-broker";
import { buildWhatsAppQueueStatus } from "./whatsapp-queue";

// Terça, 27/10/2026, 10:00 em São Paulo (13:00 UTC): dia útil, horário comercial.
const NOW = new Date("2026-10-27T13:00:00.000Z");
const minutes = (value: number) => new Date(NOW.getTime() + value * 60_000);
const director = { role: "director" as const };

describe("leads frios", () => {
  it("conta tentados e esperando; a próxima requalificação é 3 h depois de esfriar, no passo de 2 min", () => {
    const status = buildColdLeadsStatus({
      rows: [
        { coldSince: minutes(-170), attempts: 0 },
        { coldSince: minutes(-60), attempts: 0 },
        { coldSince: minutes(-300), attempts: 1 },
      ],
      now: NOW, scope: director, automaticEnabled: true, turboCovers: false,
    });
    expect(status.value).toBe(3);
    expect(status.explanation).toBe("1 já recebeu a tentativa; 2 esperam completar 3 h frio.");
    expect(status.nextEvent?.at).toBe("2026-10-27T13:10:00.000Z");
    expect(status.nextEvent?.windowStartAt).toBe(minutes(-170).toISOString());
    expect(status.action?.href).toBe("/leads/distribuicao?view=filas");
  });

  it("fora da janela de 8 h às 20 h, sai às 8 h", () => {
    const night = new Date("2026-10-27T23:30:00.000Z"); // 20:30 em SP
    const status = buildColdLeadsStatus({ rows: [{ coldSince: new Date(night.getTime() - 4 * 3_600_000), attempts: 0 }], now: night, scope: director, automaticEnabled: true, turboCovers: false });
    expect(status.nextEvent?.at).toBe("2026-10-28T11:00:00.000Z");
  });

  it("régua turbo cobrindo ou chave desligada: sem contagem, com a frase do motivo", () => {
    const rows = [{ coldSince: minutes(-10), attempts: 0 }];
    expect(buildColdLeadsStatus({ rows, now: NOW, scope: director, automaticEnabled: true, turboCovers: true }).nextEvent).toBeUndefined();
    expect(buildColdLeadsStatus({ rows, now: NOW, scope: director, automaticEnabled: false, turboCovers: false }).note).toBe("Requalificação automática desligada.");
  });

  it("zero vira frase e gravidade ok", () => {
    const status = buildColdLeadsStatus({ rows: [], now: NOW, scope: { role: "manager" }, automaticEnabled: true, turboCovers: false });
    expect(status).toMatchObject({ value: 0, severity: "ok", emptyText: "Nenhum lead frio agora" });
    expect(status.action?.href).toBe("/leads/distribuicao?view=operar");
  });
});

describe("fila de leads frios", () => {
  it("mostra 500+ ao atingir o limite de leitura", () => {
    const rows = Array.from({ length: 500 }, () => ({ coldSince: minutes(-30), attempts: 0 }));
    const status = buildColdLeadsStatus({ rows, now: NOW, scope: director, automaticEnabled: true, turboCovers: false, truncated: true });
    expect(status).toMatchObject({ value: 500, valueText: "500+" });
  });

  it("próximas 9 h em São Paulo", () => {
    expect(nextColdReleaseAt(NOW).toISOString()).toBe("2026-10-28T12:00:00.000Z");
    expect(nextColdReleaseAt(new Date("2026-10-27T10:00:00.000Z")).toISOString()).toBe("2026-10-27T12:00:00.000Z");
  });

  it("conta quem sai na próxima liberação; quem já saiu fica de fora", () => {
    const status = buildColdReleaseStatus({
      queues: [{
        queueId: "q", name: "Leads Frios", releasedEarlyToday: false,
        waitingCreatedAt: [
          new Date("2026-10-24T15:00:00.000Z"), // já liberado
          new Date("2026-10-26T15:00:00.000Z"), // segunda: sai amanhã às 9 h
          new Date("2026-10-27T12:30:00.000Z"), // hoje: sai depois de amanhã
        ],
      }],
      now: NOW, scope: director,
    });
    expect(status).toMatchObject({ label: "Fila Leads Frios", value: 1, breakdown: [{ label: "esperando liberação", value: 2 }] });
    expect(status?.nextEvent?.at).toBe("2026-10-28T12:00:00.000Z");
  });

  it("sem fila com a regra ligada, não aparece", () => {
    expect(buildColdReleaseStatus({ queues: [], now: NOW, scope: director })).toBeNull();
  });
});

describe("qualificação pela IA", () => {
  it("próximo tempo limite pela atividade mais antiga, alinhado ao robô", () => {
    const status = buildAiQualificationStatus({ rows: [{ lastActivityAt: minutes(-11) }, { lastActivityAt: minutes(-2) }], timeoutMinutes: 15, now: NOW, scope: { canOpenQualification: true } });
    expect(status.value).toBe(2);
    expect(status.nextEvent?.at).toBe("2026-10-27T13:04:00.000Z");
    expect(status.action?.href).toBe("/qualificacao");
  });
});

describe("aguardando corretor", () => {
  it("qualificação com limite atingido mostra 500+", () => {
    const rows = Array.from({ length: 500 }, () => ({ lastActivityAt: minutes(-2) }));
    const status = buildAiQualificationStatus({ rows, timeoutMinutes: 15, now: NOW, scope: { canOpenQualification: true }, truncated: true });
    expect(status).toMatchObject({ value: 500, valueText: "500+" });
  });

  it("tira os retidos por regra e mostra o motivo principal", () => {
    const status = buildWaitingBrokerStatus({
      groups: [
        { code: "PROCESSING_ERROR", holdReason: "stack trace confidencial", total: 4, nextRunAfter: minutes(1) },
        { code: null, holdReason: null, total: 2, nextRunAfter: minutes(-1) },
        { code: "HELD_BY_RULE", holdReason: "A fila está em modo manual", total: 20, nextRunAfter: minutes(10) },
      ],
      now: NOW,
    });
    expect(status.value).toBe(6);
    expect(status.severity).toBe("atencao");
    expect(status.explanation).toBe("Motivo principal: houve uma falha temporária no processamento.");
    expect(status.explanation).not.toContain("stack trace confidencial");
    expect(status.breakdown).toEqual([{ label: "retidos por regra", value: 20 }]);
    expect(status.nextEvent?.at).toBe("2026-10-27T13:02:00.000Z");
  });
});

describe("ofertas", () => {
  it("a primeira expira no horário exato; corretor vê a dele com link para a fila", () => {
    const aggregate = { total: 3, firstExpiresAt: minutes(2.5), firstOfferedAt: minutes(-2.5) };
    expect(buildOffersStatus({ aggregate, now: NOW, scope: director }).nextEvent).toMatchObject({ at: minutes(2.5).toISOString(), label: "A primeira expira" });
    const own = buildOffersStatus({ aggregate: { ...aggregate, total: 1 }, now: NOW, scope: { role: "broker" } });
    expect(own).toMatchObject({ label: "Suas ofertas aguardando aceite", severity: "atencao", action: { href: "/minha-fila" } });
    expect(buildOffersStatus({ aggregate, now: NOW, scope: { role: "supervisor" } }).action).toBeUndefined();
  });
});

describe("primeiro contato", () => {
  const settings = { firstContactMinutes: 15, graceMinutes: 5 };
  it("prazo mais próximo e atrasados", () => {
    const status = buildFirstContactStatus({ assignedAt: [minutes(-14), minutes(-30)], settings, now: NOW, scope: director });
    expect(status).toMatchObject({ value: 2, severity: "atencao", breakdown: [{ label: "no prazo", value: 1 }, { label: "atrasados", value: 1 }] });
    expect(status.nextEvent?.at).toBe(minutes(6).toISOString());
  });
  it("fora do horário comercial, mostra quando a cobrança volta", () => {
    const saturday = new Date("2026-10-31T14:00:00.000Z");
    const status = buildFirstContactStatus({ assignedAt: [new Date(saturday.getTime() - 60_000)], settings, now: saturday, scope: director });
    expect(status.nextEvent).toMatchObject({ at: "2026-11-02T11:00:00.000Z", label: "Fora do horário comercial; a cobrança volta" });
  });
});

describe("plantão", () => {
  const start = minutes(-10);
  const end = minutes(170);
  it("confirmados de escalados e tolerância de 20 min", () => {
    const status = buildDutyStatus({
      rows: [
        { status: "confirmed", shiftStartsAt: start, shiftEndsAt: end },
        { status: "pending", shiftStartsAt: start, shiftEndsAt: end },
        { status: "confirmed", shiftStartsAt: minutes(300), shiftEndsAt: minutes(600) },
      ],
      now: NOW, scope: director,
    });
    expect(status).toMatchObject({ valueText: "1 de 2", severity: "atencao" });
    expect(status.nextEvent).toMatchObject({ at: minutes(10).toISOString(), label: "A tolerância para confirmar acaba" });
  });
  it("corretor com presença pendente vê o prazo dele", () => {
    const status = buildDutyStatus({ rows: [{ status: "pending", shiftStartsAt: start, shiftEndsAt: end }], now: NOW, scope: { role: "broker" } });
    expect(status).toMatchObject({ label: "Seu plantão", valueText: "Presença pendente", action: { href: "/plantoes/agora" } });
    expect(status.nextEvent?.label).toBe("Confirme sua presença; fecha");
  });
  it("sem turno agora mostra o próximo", () => {
    const status = buildDutyStatus({ rows: [{ status: "pending", shiftStartsAt: minutes(60), shiftEndsAt: minutes(300) }], now: NOW, scope: director });
    expect(status).toMatchObject({ value: 0, emptyText: "Nenhum plantão acontecendo agora", nextEvent: { at: minutes(60).toISOString() } });
  });
});

describe("fila do WhatsApp", () => {
  const empty = { waiting: 0, held: 0, heldUntil: null, nextFreeAt: null, failedToday: 0, topErrorCode: null };
  it("seguradas saem na hora certa e falhas do dia com o motivo", () => {
    const status = buildWhatsAppQueueStatus({ aggregate: { ...empty, waiting: 14, held: 9, heldUntil: minutes(60), failedToday: 2, topErrorCode: "131026" }, heartbeat: null, now: NOW, scope: director });
    expect(status).toMatchObject({ value: 14, severity: "atencao", explanation: "2 falharam hoje: número sem WhatsApp." });
    expect(status.nextEvent).toMatchObject({ label: "As seguradas saem", at: minutes(60).toISOString() });
  });
  it("robô parado com fila vira crítico", () => {
    const heartbeat = { job: "whatsapp" as const, finishedAt: minutes(-9).toISOString(), outcome: "ok" as const, durationMs: 10 };
    const status = buildWhatsAppQueueStatus({ aggregate: { ...empty, waiting: 3, nextFreeAt: minutes(-5) }, heartbeat, now: NOW, scope: { role: "manager" } });
    expect(status.severity).toBe("critico");
    expect(status.explanation).toBe("O envio do WhatsApp não roda há 9 min. Avise o diretor.");
    expect(status.action).toBeUndefined();
  });
});

describe("selo do motor de distribuição", () => {
  const beat = (agoMinutes: number, outcome: "ok" | "erro" = "ok") => ({ job: "distribution" as const, finishedAt: minutes(-agoMinutes).toISOString(), outcome, durationMs: 100 });
  it("ativo com última e próxima rodada", () => {
    expect(buildDistributionEngineSeal({ heartbeat: beat(1), failedJobs: 0, failedEffects: 0, now: NOW, scope: director })).toMatchObject({
      label: "Motor de distribuição ativo", severity: "ok", lastRunAt: minutes(-1).toISOString(), nextRunAt: "2026-10-27T13:02:00.000Z",
    });
  });
  it("parado há mais de 3 ciclos vira crítico com o recado certo por papel", () => {
    expect(buildDistributionEngineSeal({ heartbeat: beat(9), failedJobs: 0, failedEffects: 0, now: NOW, scope: director })).toMatchObject({
      label: "Motor de distribuição parado", severity: "critico", detail: "O robô de distribuição não roda há 9 min. Avise o Vinicios.",
    });
  });
  it("falhas pedem revisão; sem heartbeat ainda é informação", () => {
    expect(buildDistributionEngineSeal({ heartbeat: beat(1), failedJobs: 2, failedEffects: 0, now: NOW, scope: director }).detail).toBe("2 leads falharam nas tentativas e pedem revisão.");
    expect(buildDistributionEngineSeal({ heartbeat: null, failedJobs: 0, failedEffects: 0, now: NOW, scope: director }).severity).toBe("info");
  });
});
