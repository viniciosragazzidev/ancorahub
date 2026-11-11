import { describe, expect, it, vi } from "vitest";

import { getMessageEventByPurpose } from "@/features/communication-channels/message-event-catalog";
import { resolveNoticeTextVariants } from "@/features/communication-channels/outbound-service";
import { teamNoticeForPurpose } from "@/features/team-notices/catalog";
import {
  closingEnteredAt,
  closingTimeLine,
  dispatchLeadConvertedDirectorAlert,
  leadConvertedDirectorAlertKey,
  leadConvertedDirectorAlertVariables,
  missingInCrm,
  saleSignalsSentence,
  type LeadConvertedAlertInput,
  type LeadConvertedDispatchDeps,
} from "./lead-converted-director-alert-core";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim() || "https://crm.ancorasaude.cloud";
const LINK = `${BASE_URL}/leads/lead-andrea`;

/** O caminho real do outbox: variáveis → texto do número da empresa (o "-" some). */
function render(variables: string[]) {
  return resolveNoticeTextVariants("leadConvertedDirectorAlert", variables, new Date("2026-11-11T13:00:00.000Z"));
}

const andrea: LeadConvertedAlertInput = {
  leadId: "lead-andrea",
  leadName: "Andrea",
  leadPhone: "21983422360",
  leadType: "PF",
  livesCount: 1,
  monthlyValue: null,
  planName: null,
  brokerName: "Carlos Eduardo 10961",
  closingEnteredAt: new Date("2026-11-03T13:00:00Z"),
  convertedAt: new Date("2026-11-11T15:00:00Z"),
  origin: { kind: "ai", signals: ["interview", "payment", "contract_signed"], quote: "Cliente: \"Já fiz o pagamento via pix\"" },
  hasPlan: false,
  hasOperatorConfirmation: false,
};

describe("venda fechada para a direção: texto", () => {
  it("venda pela IA com dados faltando (caso Andrea)", () => {
    const [text] = render(leadConvertedDirectorAlertVariables(andrea));
    expect(text).toBe([
      "🎉 *Venda fechada!*",
      "",
      "👤 *Cliente:* Andrea",
      "📞 (21) 98342-2360",
      "📋 Pessoa física · 1 vida",
      "🧑‍💼 *Corretor:* Carlos Eduardo 10961",
      "⏱️ 8 dias no fechamento (entrou em 03/11)",
      "",
      "✅ *Como a venda foi confirmada:* adesão paga, contrato assinado e entrevista da operadora concluída.",
      "💬 _\"Já fiz o pagamento via pix\"_",
      "",
      "⚠️ *Falta no CRM:* valor, operadora/plano e confirmação da operadora.",
      "",
      `👉 *Abrir no CRM:* ${LINK}`,
    ].join("\n"));
    expect(text).not.toContain("—");
  });

  it("venda pela IA sem nada faltando: sem a linha de pendências", () => {
    const [text] = render(leadConvertedDirectorAlertVariables({
      ...andrea, monthlyValue: "890.5", planName: "Amil 400", hasPlan: true, hasOperatorConfirmation: true,
    }));
    expect(text).toContain("📋 Pessoa física · 1 vida · Amil 400 · R$");
    expect(text).not.toContain("Falta no CRM");
    expect(text).toContain("💬 _\"Já fiz o pagamento via pix\"_");
  });

  it("lista só o que falta", () => {
    expect(missingInCrm({ monthlyValue: "500", hasPlan: false, hasOperatorConfirmation: true })).toEqual(["operadora/plano"]);
    expect(missingInCrm({ monthlyValue: 0, hasPlan: true, hasOperatorConfirmation: false })).toEqual(["valor", "confirmação da operadora"]);
    const [text] = render(leadConvertedDirectorAlertVariables({ ...andrea, monthlyValue: "500", hasOperatorConfirmation: true }));
    expect(text).toContain("⚠️ *Falta no CRM:* operadora/plano.");
  });

  it("venda registrada por uma pessoa: quem registrou, sem sinais nem trecho", () => {
    const [text] = render(leadConvertedDirectorAlertVariables({
      ...andrea, origin: { kind: "person", actorName: "Keyla Souza" }, monthlyValue: "700", hasPlan: true, hasOperatorConfirmation: true,
    }));
    expect(text).toContain("✅ *Registrada por:* Keyla Souza");
    expect(text).not.toContain("Como a venda foi confirmada");
    expect(text).not.toContain("💬");
    expect(text).not.toContain("Falta no CRM");
  });

  it("sem a entrada no fechamento, a linha ⏱️ some", () => {
    const [text] = render(leadConvertedDirectorAlertVariables({ ...andrea, closingEnteredAt: null }));
    expect(text).not.toContain("⏱️");
    expect(text).toContain("🧑‍💼 *Corretor:* Carlos Eduardo 10961\n\n✅");
  });

  it("dias no fechamento", () => {
    const converted = new Date("2026-11-11T15:00:00Z");
    expect(closingTimeLine(new Date("2026-11-11T10:00:00Z"), converted)).toBe("Menos de 1 dia no fechamento (entrou em 11/11)");
    expect(closingTimeLine(new Date("2026-11-10T12:00:00Z"), converted)).toBe("1 dia no fechamento (entrou em 10/11)");
    expect(closingTimeLine(null, converted)).toBeNull();
  });

  it("entrada no fechamento pelo histórico: a sequência que termina na venda", () => {
    const at = (iso: string) => new Date(iso);
    const history = [
      { fromStatus: "new", toStatus: "negotiation", changedAt: at("2026-10-20T12:00:00Z") },
      { fromStatus: "negotiation", toStatus: "documentation_pending", changedAt: at("2026-10-25T12:00:00Z") },
      { fromStatus: "documentation_pending", toStatus: "negotiation", changedAt: at("2026-10-28T12:00:00Z") },
      { fromStatus: "negotiation", toStatus: "documentation_pending", changedAt: at("2026-11-03T13:00:00Z") },
      { fromStatus: "documentation_pending", toStatus: "awaiting_reply", changedAt: at("2026-11-05T12:00:00Z") },
      { fromStatus: "awaiting_reply", toStatus: "under_analysis", changedAt: at("2026-11-07T12:00:00Z") },
      { fromStatus: "under_analysis", toStatus: "converted", changedAt: at("2026-11-11T15:00:00Z") },
    ];
    expect(closingEnteredAt({ history: [...history].reverse(), previousStatus: "under_analysis", previousStageEnteredAt: null })).toEqual(at("2026-11-03T13:00:00Z"));
    // Pulou o fechamento: sem linha.
    expect(closingEnteredAt({
      history: [{ fromStatus: "negotiation", toStatus: "converted", changedAt: at("2026-11-11T15:00:00Z") }],
      previousStatus: "negotiation",
      previousStageEnteredAt: at("2026-11-01T12:00:00Z"),
    })).toBeNull();
    // Sem histórico: a entrada na etapa anterior, se era do fechamento.
    expect(closingEnteredAt({ history: [], previousStatus: "under_analysis", previousStageEnteredAt: at("2026-11-04T12:00:00Z") })).toEqual(at("2026-11-04T12:00:00Z"));
  });

  it("sinais na ordem do catálogo, sem sinal desconhecido", () => {
    expect(saleSignalsSentence(["interview", "payment"])).toBe("adesão paga e entrevista da operadora concluída");
    expect(saleSignalsSentence(["x"])).toBe("");
    const [text] = render(leadConvertedDirectorAlertVariables({ ...andrea, origin: { kind: "ai", signals: [], quote: null } }));
    expect(text).toContain("✅ *Como a venda foi confirmada:* venda vista pela IA na conversa.");
    expect(text).not.toContain("💬");
  });

  it("variáveis dentro do limite de 512 do envio, mesmo com texto longo", () => {
    const variables = leadConvertedDirectorAlertVariables({
      ...andrea,
      leadName: "A".repeat(900),
      brokerName: "B".repeat(900),
      planName: "P".repeat(900),
      origin: { kind: "ai", signals: ["payment"], quote: "x".repeat(2000) },
    });
    expect(variables).toHaveLength(10);
    expect(getMessageEventByPurpose("leadConvertedDirectorAlert")?.variables).toHaveLength(variables.length);
    expect(variables.every((value) => value.length >= 1 && value.length <= 512)).toBe(true);
    expect(variables[7]!.length).toBeLessThanOrEqual(200);
    expect(variables[7]!.endsWith("…")).toBe(true);
    expect(variables[9]).toBe("lead-andrea");
  });

  it("telefone como no aviso de fechamento, com ou sem 55", () => {
    expect(leadConvertedDirectorAlertVariables({ ...andrea, leadPhone: "+55 (21) 98342-2360" })[1]).toBe("(21) 98342-2360");
    expect(leadConvertedDirectorAlertVariables({ ...andrea, leadPhone: "2133334444" })[1]).toBe("(21) 3333-4444");
    expect(leadConvertedDirectorAlertVariables({ ...andrea, leadPhone: null })[1]).toBe("Sem telefone");
  });

  it("aviso crítico pelo número da empresa, ligado por padrão, com 4 versões", () => {
    const notice = teamNoticeForPurpose("leadConvertedDirectorAlert");
    expect(notice?.key).toBe("LEAD_CONVERTED_DIRECTOR");
    expect(notice?.label).toBe("Venda fechada para a direção");
    expect(notice?.class).toBe("critical");
    expect(notice?.defaultEnabled).toBe(true);
    expect(notice?.defaultChannel).toBe("company_number");
    expect(notice?.phoneRecipients).toBe(true);
    const versions = render(leadConvertedDirectorAlertVariables(andrea));
    expect(versions).toHaveLength(4);
    for (const text of versions) {
      expect(text).toContain("Andrea");
      expect(text).toContain("Carlos Eduardo 10961");
      expect(text).toContain("/leads/lead-andrea");
    }
  });
});

describe("venda fechada para a direção: disparo", () => {
  /** Outbox falsa: a chave idempotente repetida não manda de novo, como a de verdade. */
  function fakeDeps(overrides: Partial<LeadConvertedDispatchDeps> = {}) {
    const outbox = new Map<string, string[]>();
    const send = vi.fn(async (_phone: string, variables: string[], key: string) => {
      if (outbox.has(key)) return false;
      outbox.set(key, variables);
      return true;
    });
    const deps: LeadConvertedDispatchDeps = {
      recipients: async () => ["5521964625966", "5521999990000"],
      enabled: async () => true,
      variables: async () => leadConvertedDirectorAlertVariables(andrea),
      send,
      log: vi.fn(),
      ...overrides,
    };
    return { deps, outbox, send };
  }
  const trigger = { tenantId: "t1", leadId: "lead-andrea", previousStatus: "under_analysis", newStatus: "converted" };

  it("IA e pessoa disparam uma vez por número", async () => {
    const { deps, outbox } = fakeDeps();
    expect(await dispatchLeadConvertedDirectorAlert(trigger, deps)).toEqual({ notified: 2 });
    expect([...outbox.keys()]).toEqual([
      "lead-converted-director:lead-andrea:5521964625966",
      "lead-converted-director:lead-andrea:5521999990000",
    ]);
    const person = fakeDeps({ variables: async () => leadConvertedDirectorAlertVariables({ ...andrea, origin: { kind: "person", actorName: "Ana" } }) });
    expect(await dispatchLeadConvertedDirectorAlert({ ...trigger, previousStatus: "documentation_pending" }, person.deps)).toEqual({ notified: 2 });
  });

  it("segunda conversão do mesmo lead não duplica", async () => {
    const { deps, send } = fakeDeps();
    await dispatchLeadConvertedDirectorAlert(trigger, deps);
    // Voltou para Em análise e converteu de novo (outra origem): mesma chave por lead e número.
    expect(await dispatchLeadConvertedDirectorAlert({ ...trigger, previousStatus: "under_analysis" }, deps)).toEqual({ notified: 0 });
    expect(send).toHaveBeenCalledTimes(4);
    expect(leadConvertedDirectorAlertKey("lead-andrea", "5521964625966")).toBe("lead-converted-director:lead-andrea:5521964625966");
  });

  it("já estava convertido, ou não virou venda: nada sai", async () => {
    const { deps, send } = fakeDeps();
    expect(await dispatchLeadConvertedDirectorAlert({ ...trigger, previousStatus: "converted" }, deps)).toEqual({ notified: 0 });
    expect(await dispatchLeadConvertedDirectorAlert({ ...trigger, newStatus: "under_analysis", previousStatus: "negotiation" }, deps)).toEqual({ notified: 0 });
    expect(send).not.toHaveBeenCalled();
  });

  it("aviso desligado não envia", async () => {
    const variables = vi.fn(async () => leadConvertedDirectorAlertVariables(andrea));
    const { deps, send } = fakeDeps({ enabled: async () => false, variables });
    expect(await dispatchLeadConvertedDirectorAlert(trigger, deps)).toEqual({ notified: 0 });
    expect(send).not.toHaveBeenCalled();
    expect(variables).not.toHaveBeenCalled();
  });

  it("sem destinatários não envia", async () => {
    const enabled = vi.fn(async () => true);
    const { deps, send } = fakeDeps({ recipients: async () => [], enabled });
    expect(await dispatchLeadConvertedDirectorAlert(trigger, deps)).toEqual({ notified: 0 });
    expect(send).not.toHaveBeenCalled();
    expect(enabled).not.toHaveBeenCalled();
  });

  it("falha de envio não lança erro e o log não leva telefone nem nome", async () => {
    const log = vi.fn();
    const { deps } = fakeDeps({
      log,
      send: vi.fn(async (phone: string) => {
        if (phone === "5521964625966") throw new Error("waha down");
        return true;
      }),
    });
    expect(await dispatchLeadConvertedDirectorAlert(trigger, deps)).toEqual({ notified: 1 });
    const broken = fakeDeps({ log, variables: async () => { throw new Error("db down"); } });
    await expect(dispatchLeadConvertedDirectorAlert(trigger, broken.deps)).resolves.toEqual({ notified: 0 });
    const logged = JSON.stringify(log.mock.calls);
    expect(logged).toContain("lead-andrea");
    expect(logged).not.toContain("5521964625966");
    expect(logged).not.toContain("Andrea\"");
  });
});
