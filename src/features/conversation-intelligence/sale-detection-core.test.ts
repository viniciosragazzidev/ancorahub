import { describe, expect, it } from "vitest";

import { ConversationAssessmentSchema } from "./types";
import {
  aiSaleBrokerNotice,
  aiSaleDirectorNotice,
  aiSaleMissingItems,
  aiSaleNotificationKey,
  aiSaleRegistrationPending,
  decideAiSaleConversion,
  legacySaleSignals,
  readSaleCompleted,
  type AiSaleDecisionInput,
} from "./sale-detection-core";

const confirmed = readSaleCompleted({
  status: "confirmed",
  signals: ["payment", "proposal_transmitted", "medical_interview_approved"],
  evidence: ["paguei a adesão, segue o comprovante"],
});

function input(overrides: Partial<AiSaleDecisionInput> = {}): AiSaleDecisionInput {
  return {
    status: "documentation_pending",
    saleCompleted: confirmed,
    mode: "auto",
    hasBroker: true,
    ownerIsDirector: false,
    alreadyDetected: false,
    personMovedOutOfConverted: false,
    hasActiveSale: false,
    recentlyUndone: false,
    ...overrides,
  };
}

describe("saleCompleted no schema da análise", () => {
  const base = {
    conversationStage: "CLOSING",
    customerIntent: "VERY_HIGH",
    engagement: "HIGH",
    sentiment: "POSITIVE",
    pendingFrom: "BROKER",
    nextBestAction: "Acompanhar a carteirinha",
    statusConfidence: 0.8,
    summary: "A cliente pagou a adesão e a proposta foi transmitida.",
  };

  it("análise antiga, sem o campo, continua válida e lê como 'no'", () => {
    const parsed = ConversationAssessmentSchema.parse(base);
    expect(parsed.saleCompleted).toBeUndefined();
    expect(readSaleCompleted(parsed.saleCompleted).status).toBe("no");
  });

  it("valor fora do formato vira 'no' sem derrubar a análise", () => {
    const parsed = ConversationAssessmentSchema.parse({ ...base, saleCompleted: { status: "talvez", signals: "pix", evidence: 3 } });
    expect(parsed.saleCompleted).toEqual({ status: "no", signals: [], evidence: [] });
    expect(ConversationAssessmentSchema.parse({ ...base, saleCompleted: "sim" }).saleCompleted?.status).toBe("no");
  });

  it("descarta sinais desconhecidos e repetidos", () => {
    const parsed = readSaleCompleted({ status: "confirmed", signals: ["payment", "payment", "vibes"], evidence: ["  pix feito  "] });
    expect(parsed).toEqual({ status: "confirmed", signals: ["payment"], evidence: ["pix feito"] });
  });
});

describe("decideAiSaleConversion", () => {
  it("converte em Documentação e Em análise com pagamento ou proposta transmitida", () => {
    const decision = decideAiSaleConversion(input());
    expect(decision).toMatchObject({ convert: true, reason: "Venda detectada pela IA: adesão paga, proposta transmitida, entrevista médica aprovada" });
    expect(decideAiSaleConversion(input({ status: "under_analysis" })).convert).toBe(true);
  });

  it("nunca converte por 'likely' ou 'no'", () => {
    expect(decideAiSaleConversion(input({ saleCompleted: { ...confirmed, status: "likely" } })).convert).toBe(false);
    expect(decideAiSaleConversion(input({ saleCompleted: { ...confirmed, status: "no" } })).convert).toBe(false);
  });

  it("exige trecho da conversa", () => {
    expect(decideAiSaleConversion(input({ saleCompleted: { ...confirmed, evidence: [] } })).convert).toBe(false);
  });

  it("assinatura ou entrevista sozinhas não bastam", () => {
    const weak = { status: "confirmed" as const, signals: ["contract_signed", "medical_interview_approved"] as const, evidence: ["assinei"] };
    expect(decideAiSaleConversion(input({ saleCompleted: { ...weak, signals: [...weak.signals] } })).convert).toBe(false);
  });

  it("em Negociação só com pagamento ou proposta transmitida", () => {
    const card = { status: "confirmed" as const, signals: ["card_or_proposal_number" as const], evidence: ["número da proposta 123"] };
    expect(decideAiSaleConversion(input({ status: "documentation_pending", saleCompleted: card })).convert).toBe(true);
    expect(decideAiSaleConversion(input({ status: "negotiation", saleCompleted: card })).convert).toBe(false);
    expect(decideAiSaleConversion(input({ status: "negotiation" })).convert).toBe(true);
  });

  it("etapas anteriores, lead perdido ou convertido nunca convertem", () => {
    for (const status of ["new", "distributed", "in_contact", "quote_sent", "awaiting_reply", "lost", "converted"]) {
      expect(decideAiSaleConversion(input({ status })).convert).toBe(false);
    }
  });

  it("é idempotente: uma vez por lead", () => {
    expect(decideAiSaleConversion(input({ alreadyDetected: true }))).toEqual({ convert: false, why: "A IA já converteu este lead uma vez." });
  });

  it("respeita quem tirou o lead de Convertido, o Desfazer recente e a venda já registrada", () => {
    expect(decideAiSaleConversion(input({ personMovedOutOfConverted: true })).convert).toBe(false);
    expect(decideAiSaleConversion(input({ recentlyUndone: true })).convert).toBe(false);
    expect(decideAiSaleConversion(input({ hasActiveSale: true })).convert).toBe(false);
  });

  it("não mexe em lead de diretor nem em lead sem corretor", () => {
    expect(decideAiSaleConversion(input({ ownerIsDirector: true })).convert).toBe(false);
    expect(decideAiSaleConversion(input({ hasBroker: false })).convert).toBe(false);
  });

  it("só no modo automático da empresa", () => {
    expect(decideAiSaleConversion(input({ mode: "suggest" })).convert).toBe(false);
    expect(decideAiSaleConversion(input({ mode: "off" })).convert).toBe(false);
  });
});

describe("avisos", () => {
  it("chave única por lead e pessoa", () => {
    expect(aiSaleNotificationKey("lead-1", "user-1")).toBe("lead-ai-sale:lead-1:user-1");
    expect(aiSaleNotificationKey("lead-1", "user-1")).toBe(aiSaleNotificationKey("lead-1", "user-1"));
    expect(aiSaleNotificationKey("lead-1", "user-2")).not.toBe(aiSaleNotificationKey("lead-1", "user-1"));
  });

  it("parabeniza o corretor e pede o que falta", () => {
    const notice = aiSaleBrokerNotice("Claudiana Maximo Renato", ["documentos da venda (2 pendentes)", "valor", "vidas"]);
    expect(notice.title).toBe("Parabéns! A venda de Claudiana Maximo Renato foi concluída");
    expect(notice.message).toContain("Envie a documentação da venda e complete no CRM: documentos da venda (2 pendentes), valor, vidas.");
    expect(aiSaleBrokerNotice(null).message).toContain("conclua o Registrar venda");
  });

  it("avisa a direção com corretor, motivo e trecho", () => {
    const notice = aiSaleDirectorNotice({ leadName: "Claudiana", brokerName: "Raiana Nunes", reason: "Venda detectada pela IA: adesão paga", evidence: ["paguei"] });
    expect(notice.title).toBe("Venda fechada: Claudiana");
    expect(notice.message).toBe('Corretor: Raiana Nunes. Venda detectada pela IA: adesão paga. Trecho: "paguei". O corretor foi parabenizado e vai completar o registro.');
  });

  it("nenhum texto usa travessão", () => {
    const texts = [
      ...Object.values(aiSaleBrokerNotice("A", ["valor"])),
      ...Object.values(aiSaleDirectorNotice({ leadName: "A", brokerName: "B", reason: "r", evidence: [] })),
    ];
    for (const text of texts) expect(text).not.toContain(String.fromCharCode(0x2014));
  });
});

describe("aiSaleMissingItems", () => {
  it("lista documentos, confirmação, valor, operadora e vidas faltando", () => {
    expect(aiSaleMissingItems({ pendingRequiredDocuments: 2, hasApprovedDocument: false, monthlyValue: null, hasPlan: false, livesCount: null }))
      .toEqual(["documentos da venda (2 pendentes)", "confirmação da operadora", "valor", "operadora/plano", "vidas"]);
  });
  it("nada faltando, lista vazia", () => {
    expect(aiSaleMissingItems({ pendingRequiredDocuments: 0, hasApprovedDocument: true, monthlyValue: "450.00", hasPlan: true, livesCount: 1 })).toEqual([]);
  });
});

describe("aiSaleRegistrationPending", () => {
  it("só com o lead Convertido e o registro pendente", () => {
    expect(aiSaleRegistrationPending("converted", { aiSaleDetected: { registrationPending: true } })).toBe(true);
    expect(aiSaleRegistrationPending("converted", { aiSaleDetected: { registrationPending: false } })).toBe(false);
    expect(aiSaleRegistrationPending("documentation_pending", { aiSaleDetected: { registrationPending: true } })).toBe(false);
    expect(aiSaleRegistrationPending("converted", null)).toBe(false);
  });
});

describe("legacySaleSignals (relatório)", () => {
  it("lê o caso da Claudiana", () => {
    const result = legacySaleSignals({
      facts: [
        "Proposta Individual assinada e transmitida à operadora",
        "Adesão de R$ 500,00 com desconto paga via Pix; comprovante enviado às 12:45",
        "Entrevista médica confirmada e aprovada",
        "Carteirinha ainda não emitida",
      ],
      buyingSignals: [],
    });
    expect(result.signals).toEqual(expect.arrayContaining(["payment", "proposal_transmitted", "medical_interview_approved"]));
    expect(result.signals).not.toContain("card_or_proposal_number");
  });
  it("intenção sozinha não conta", () => {
    expect(legacySaleSignals({ facts: ["Cliente quer fechar ainda hoje"], buyingSignals: ["Pediu o boleto"] }).signals).toEqual([]);
  });
});
