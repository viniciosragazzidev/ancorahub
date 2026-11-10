import { describe, expect, it } from "vitest";

import { ConversationAssessmentSchema } from "./types";
import {
  aiSaleBrokerNotice,
  aiSaleDirectorNotice,
  aiSaleMissingItems,
  aiSaleNotificationKey,
  aiSaleMarkerStatus,
  aiSalePrompt,
  aiSalePromptCopy,
  aiSaleRegistrationPending,
  aiSaleSuggestionNotice,
  decideAiSaleConversion,
  evidenceProves,
  normalizeEvidenceText,
  saleEvidenceProven,
  validateSaleEvidence,
  type SaleEvidenceMessage,
  legacySaleSignals,
  readSaleCompleted,
  mergeSaleCompletedWithExplicitEvidence,
  selectSaleDetectionTranscript,
  readValidatedPaymentEvidence,
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

  it("assinatura sozinha não basta e entrevista aprovada prova conclusão", () => {
    const signature = { status: "confirmed" as const, signals: ["contract_signed"] as const, evidence: ["assinei"] };
    expect(decideAiSaleConversion(input({ saleCompleted: { ...signature, signals: [...signature.signals] } })).convert).toBe(false);
    const approvedInterview = { status: "confirmed" as const, signals: ["medical_interview_approved"] as const, evidence: ["entrevista aprovada"] };
    expect(decideAiSaleConversion(input({ saleCompleted: { ...approvedInterview, signals: [...approvedInterview.signals] } })).convert).toBe(true);
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

  it("modo sugestão pede confirmação em vez de converter, uma vez", () => {
    const suggest = decideAiSaleConversion(input({ mode: "suggest" }));
    expect(suggest).toMatchObject({ convert: false, suggest: true });
    expect(decideAiSaleConversion(input({ mode: "suggest", alreadySuggested: true }))).toMatchObject({ convert: false, why: "A venda já foi sugerida ao corretor." });
    expect(decideAiSaleConversion(input({ mode: "suggest", ownerIsDirector: true })).convert).toBe(false);
  });

  it("modo desligado não converte nem sugere", () => {
    const off = decideAiSaleConversion(input({ mode: "off" }));
    expect(off.convert).toBe(false);
    expect("suggest" in off && off.suggest).toBeFalsy();
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

describe("conferência do trecho com a conversa real", () => {
  const messages: SaleEvidenceMessage[] = [
    { sender: "broker", text: "Me manda o comprovante do pix da adesão, por favor" },
    { sender: "customer", text: "Pronto, já paguei a adesão agora! Segue o comprovante 🙏" },
    { sender: "customer", text: "[documento: comprovante_pix.pdf]" },
    { sender: "broker", text: "Sua proposta foi transmitida para a operadora hoje." },
    { sender: "system", text: "Pagamento confirmado pelo robô" },
    { sender: "customer", text: "[text]" },
  ];

  it("normaliza acento, pontuação e espaços", () => {
    expect(normalizeEvidenceText("  Já PAGUEI a adesão!!  ")).toBe("ja paguei a adesao");
  });

  it("aceita trecho literal com quem disse, e marca o que prova", () => {
    const validated = validateSaleEvidence(["Cliente: \"já paguei a adesão agora\"", "Corretor: sua proposta foi transmitida para a operadora"], messages);
    expect(validated).toEqual([
      { quote: "Cliente: \"já paguei a adesão agora\"", sender: "customer", proves: "payment" },
      { quote: "Corretor: sua proposta foi transmitida para a operadora", sender: "broker", proves: "transmission" },
    ]);
    expect(saleEvidenceProven(validated)).toBe(true);
  });

  it("aceita trecho com 80% dos termos de uma mensagem", () => {
    const validated = validateSaleEvidence(["Cliente: pronto ja paguei a adesao segue comprovante"], messages);
    expect(validated).toHaveLength(1);
    expect(validated[0]?.proves).toBe("payment");
  });

  it("rejeita trecho inventado, mensagem do sistema e trecho curto", () => {
    expect(validateSaleEvidence(["Cliente: paguei a primeira mensalidade no boleto ontem"], messages)).toEqual([]);
    expect(validateSaleEvidence(["Pagamento confirmado pelo robô"], messages)).toEqual([]);
    expect(validateSaleEvidence(["Cliente: ok", "sim"], messages)).toEqual([]);
  });

  it("entrevista médica concluída ou aprovada é evidência de entrevista", () => {
    const onlyInterview = validateSaleEvidence(["Corretor: entrevista médica aprovada"], [{ sender: "broker", text: "Entrevista médica aprovada!" }]);
    expect(onlyInterview).toHaveLength(1);
    expect(onlyInterview[0]?.proves).toBe("interview");
    expect(saleEvidenceProven(onlyInterview)).toBe(true);
    expect(decideAiSaleConversion(input({ saleCompleted: {
      status: "confirmed", signals: ["medical_interview_approved"], evidence: ["entrevista médica aprovada"],
    } })).convert).toBe(true);
  });

  it("inclui provas antigas de pagamento e transmissão além das últimas mensagens", () => {
    const transcript = selectSaleDetectionTranscript([
      { id: "payment", sender: "customer", text: "Já fiz o pagamento via pix", timestamp: new Date("2026-11-04T13:11:19Z") },
      { id: "transmission", sender: "broker", text: "Sua proposta foi transmitida para a operadora", timestamp: new Date("2026-11-04T13:12:00Z") },
      { id: "interview", sender: "customer", text: "Consegui fazer o videio chamanda", timestamp: new Date("2026-11-09T17:23:00Z") },
      ...Array.from({ length: 14 }, (_, index) => ({
        id: `recent-${index}`,
        sender: index % 2 ? "broker" as const : "customer" as const,
        text: `Mensagem recente ${index}`,
        timestamp: new Date(`2026-11-09T13:${String(index).padStart(2, "0")}:00Z`),
      })),
    ], 4);

    expect(transcript.map((message) => message.id)).toContain("payment");
    expect(transcript.map((message) => message.id)).toContain("transmission");
    expect(transcript.map((message) => message.id)).toContain("interview");
    expect(transcript.map((message) => message.id)).toContain("recent-13");
    expect(transcript.map((message) => message.id)).not.toContain("recent-0");
  });

  it("considera entrevista concluída uma prova forte, com acentos e erros comuns", () => {
    for (const phrase of [
      "Consegui fazer o videio chamanda",
      "fiz a entrevista",
      "Já fiz a videochamada",
      "entrevista feita",
      "entrevista aprovada",
    ]) {
      expect(evidenceProves(phrase, "customer")).toBe("interview");
      expect(evidenceProves(phrase, "broker")).toBe("interview");
    }
    expect(evidenceProves("vou fazer a entrevista", "customer")).toBeNull();
    expect(evidenceProves("quando é a video chamada?", "customer")).toBeNull();
    expect(evidenceProves("não consegui fazer a entrevista", "customer")).toBeNull();
    expect(evidenceProves("vou tentar agora a chamada", "customer")).toBeNull();
    expect(decideAiSaleConversion(input({ saleCompleted: {
      status: "confirmed", signals: ["interview"], evidence: ["Cliente: Consegui fazer o videio chamanda"],
    } })).convert).toBe(true);
  });

  it("recupera a classificação quando há prova explícita do pagamento ou entrevista", () => {
    const recovered = mergeSaleCompletedWithExplicitEvidence(readSaleCompleted({ status: "no", signals: [], evidence: [] }), [
      { sender: "customer", text: "Já fiz o pagamento via pix" },
      { sender: "customer", text: "Consegui fazer o videio chamanda" },
      { sender: "customer", text: "Vou tentar agora a chamada" },
      { sender: "system", text: "Entrevista médica concluída" },
    ]);

    expect(recovered.status).toBe("confirmed");
    expect(recovered.signals).toEqual(["payment", "interview"]);
    expect(recovered.evidence).toEqual([
      "Cliente: Já fiz o pagamento via pix",
      "Cliente: Consegui fazer o videio chamanda",
    ]);
  });

  it("recupera só evidência de pagamento validada em análises anteriores", () => {
    expect(readValidatedPaymentEvidence({
      aiSaleEvidence: { paymentEvidence: ["Cliente: Já fiz o pagamento via pix", "", 4] },
      aiSaleDetected: { status: "unverified", signals: ["payment"], evidence: ["não validada"] },
    })).toEqual(["Cliente: Já fiz o pagamento via pix"]);
    expect(readValidatedPaymentEvidence({
      aiSaleDetected: { status: "suggested", signals: ["payment"], evidence: ["Cliente: paguei a adesão"] },
    })).toEqual(["Cliente: paguei a adesão"]);
    expect(readValidatedPaymentEvidence({
      aiSaleDetected: { status: "converted", signals: ["payment", "proposal_transmitted"], evidence: ["Cliente: paguei a adesão", "Corretor: sua proposta foi transmitida"] },
    })).toEqual(["Cliente: paguei a adesão"]);
    expect(readValidatedPaymentEvidence({
      aiSaleDetected: { status: "unverified", signals: ["payment"], evidence: ["não validada"] },
    })).toEqual([]);
  });
});

describe("quem disse o pagamento", () => {
  it("cliente: paguei, pix feito, segue o comprovante", () => {
    expect(evidenceProves("paguei a adesão", "customer")).toBe("payment");
    expect(evidenceProves("Pix feito!", "customer")).toBe("payment");
    expect(evidenceProves("segue o comprovante", "customer")).toBe("payment");
  });

  it("corretor só quando dá o pagamento como feito", () => {
    expect(evidenceProves("Recebi o comprovante, obrigado", "broker")).toBe("payment");
    expect(evidenceProves("Pagamento confirmado!", "broker")).toBe("payment");
    expect(evidenceProves("Adesão paga, agora é aguardar", "broker")).toBe("payment");
    expect(evidenceProves("Proposta transmitida para a operadora", "broker")).toBe("transmission");
  });

  it("pedido ou promessa nunca prova", () => {
    for (const text of ["Me manda o comprovante do pix", "Pode pagar a adesão hoje", "Vou te mandar o boleto", "Assim que pagar me avisa", "Vou fazer o pix amanhã"]) {
      expect(evidenceProves(text, "broker")).toBeNull();
      expect(evidenceProves(text, "customer")).toBeNull();
    }
  });

  it("corretor dizendo 'paguei' ou cliente dizendo 'pagamento confirmado' não valem", () => {
    expect(evidenceProves("paguei a adesão", "broker")).toBeNull();
    expect(evidenceProves("pagamento confirmado", "customer")).toBeNull();
  });

  it("pedido real na conversa é conferido mas não prova", () => {
    const validated = validateSaleEvidence(["Corretor: me manda o comprovante do pix"], [{ sender: "broker", text: "Me manda o comprovante do pix" }]);
    expect(validated).toEqual([{ quote: "Corretor: me manda o comprovante do pix", sender: "broker", proves: null }]);
    expect(saleEvidenceProven(validated)).toBe(false);
  });
});

describe("arquivo sozinho como prova", () => {
  it("vale quando o cliente envia arquivo com nome de pagamento", () => {
    const validated = validateSaleEvidence(["Cliente: [documento: comprovante_pix.pdf]"], [
      { sender: "broker", text: "Oi, tudo bem?" },
      { sender: "customer", text: "[documento: comprovante_pix.pdf]" },
    ]);
    expect(validated).toEqual([{ quote: "Cliente: [documento: comprovante_pix.pdf]", sender: "customer", proves: "payment" }]);
  });

  it("vale quando o cliente envia o arquivo logo depois do pedido de pagamento", () => {
    const validated = validateSaleEvidence(["Cliente: [imagem]"], [
      { sender: "broker", text: "Pode fazer o pix da adesão e me manda o comprovante" },
      { sender: "customer", text: "[imagem]" },
    ]);
    expect(validated[0]?.proves).toBe("payment");
  });

  it("não vale sem pedido antes nem nome de pagamento", () => {
    const validated = validateSaleEvidence(["Cliente: [imagem]", "Cliente: [documento: rg_frente.jpg]"], [
      { sender: "broker", text: "Me manda seu RG, por favor" },
      { sender: "customer", text: "[documento: rg_frente.jpg]" },
      { sender: "customer", text: "[imagem]" },
    ]);
    expect(validated.map((item) => item.proves)).toEqual([null, null]);
    expect(saleEvidenceProven(validated)).toBe(false);
  });

  it("não vale quando o arquivo foi enviado pelo corretor", () => {
    const validated = validateSaleEvidence(["Corretor: [documento: comprovante.pdf]"], [
      { sender: "broker", text: "[documento: comprovante.pdf]" },
    ]);
    expect(validated).toEqual([]);
  });

  it("pedido muito antes do arquivo não conta", () => {
    const validated = validateSaleEvidence(["Cliente: [imagem]"], [
      { sender: "broker", text: "Me manda o comprovante do pix" },
      { sender: "customer", text: "Amanhã eu vejo" },
      { sender: "broker", text: "Combinado" },
      { sender: "customer", text: "Qual a carência?" },
      { sender: "customer", text: "[imagem]" },
    ]);
    expect(validated[0]?.proves).toBeNull();
  });
});

describe("marcador e card da ficha", () => {
  it("lê o estado do marcador (antigo sem status conta como converted)", () => {
    expect(aiSaleMarkerStatus({ aiSaleDetected: { registrationPending: true } })).toBe("converted");
    expect(aiSaleMarkerStatus({ aiSaleDetected: { status: "suggested" } })).toBe("suggested");
    expect(aiSaleMarkerStatus({ aiSaleDetected: { status: "unverified" } })).toBe("unverified");
    expect(aiSaleMarkerStatus({})).toBeNull();
  });

  it("escolhe o card: registrar, confirmar ou conferir", () => {
    expect(aiSalePrompt("converted", { aiSaleDetected: { status: "converted", registrationPending: true } })).toBe("register");
    expect(aiSalePrompt("documentation_pending", { aiSaleDetected: { status: "suggested" } })).toBe("confirm");
    expect(aiSalePrompt("under_analysis", { aiSaleDetected: { status: "unverified" } })).toBe("check");
    expect(aiSalePrompt("converted", { aiSaleDetected: { status: "suggested" } })).toBeNull();
    expect(aiSalePrompt("lost", { aiSaleDetected: { status: "unverified" } })).toBeNull();
    expect(aiSalePromptCopy("confirm").title).toBe("A IA detectou a venda: confirmar?");
  });

  it("sugestão pergunta antes de converter", () => {
    expect(aiSaleSuggestionNotice({ leadName: "Claudiana", reason: "Venda detectada pela IA: adesão paga" }).title).toBe("A IA detectou a venda de Claudiana: confirmar?");
  });
});

describe("transmissão só como fato dito pelo corretor", () => {
  it("aceita o corretor dizendo que transmitiu; recusa pergunta, futuro, negativa e cliente", async () => {
    const { evidenceProves } = await import("./sale-detection-core");
    expect(evidenceProves("Corretor: Proposta transmitida para a operadora", "broker")).toBe("transmission");
    expect(evidenceProves("Corretor: a proposta vai ser transmitida amanhã", "broker")).toBeNull();
    expect(evidenceProves("Corretor: será transmitida depois da entrevista", "broker")).toBeNull();
    expect(evidenceProves("Corretor: ainda não foi transmitida", "broker")).toBeNull();
    expect(evidenceProves("Cliente: já transmitiram?", "customer")).toBeNull();
    expect(evidenceProves("Cliente: a proposta foi transmitida", "customer")).toBeNull();
  });
});
