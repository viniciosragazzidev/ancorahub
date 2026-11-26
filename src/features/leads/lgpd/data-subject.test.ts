import { describe, expect, it } from "vitest";

import {
  anonymizeAiConversationRow,
  anonymizeAutoSaleDealRow,
  anonymizeAutoSaleTurnRow,
  anonymizeProposalRow,
  anonymizeQuoteRow,
  anonymizeSaleRow,
  ANONYMIZED_AI_TEXT,
  ANONYMIZED_DOCUMENT_FILENAME,
  ANONYMIZED_FREE_TEXT,
  ANONYMIZED_HOLDER_NAME,
  ANONYMIZED_MESSAGE_TEXT,
  ANONYMIZED_SALE_NOTE_TEXT,
  buildLeadAnonymization,
  planLeadDocumentRemoval,
  redactFreeText,
  redactNameInText,
  scrubConversationJson,
  checkDataSubjectAccess,
  dataSubjectExportFilename,
  isPersonalKey,
  scrubPersonalJson,
  validateAnonymizeRequest,
} from "./data-subject";

describe("anonimização do titular", () => {
  const patch = buildLeadAnonymization({
    formData: { nome: "Ana Souza", cpf: "123.456.789-00", telefone: "21999990000", email: "ana@x.com", dependentes: "2", mediaIdades: "34", razaoSocial: "Ana ME", funcionarios: "3" },
    qualificationDetails: {
      numberOfLives: "3",
      averageAge: "34",
      cidade: "Niterói",
      neighborhood: "Icaraí",
      resumoAtendimento: "Ana tem diabetes e quer plano rápido",
      beneficiaries: [{ age: 34, relation: "titular", text: "eu, Ana" }],
      contato: { cpf_titular: "123", data_nascimento: "1990-01-01", plano: "Amil" },
    },
    sourceMetadata: { campaignName: "Black Friday", adName: "Anúncio 1", field_data: [{ name: "full_name", values: ["Ana"] }, { name: "phone_number", values: ["+55"] }, { name: "qtd_vidas", values: ["3"] }] },
  });

  it("troca o nome e zera telefone e e-mail do lead e do cliente", () => {
    expect(patch.lead.nome).toBe(ANONYMIZED_HOLDER_NAME);
    expect(patch.lead.telefone).toBe("");
    expect(patch.lead.email).toBeNull();
    expect(patch.client).toEqual({ nome: ANONYMIZED_HOLDER_NAME, telefone: "", email: null });
    expect(patch.beneficiary).toMatchObject({ cpf: null, birthDate: null });
    expect(patch.message.phone).toBe("");
  });

  it("apaga CPF, contato, nascimento e texto livre do formulário e da qualificação", () => {
    expect(patch.lead.formData).toEqual({ dependentes: "2", mediaIdades: "34", razaoSocial: "Ana ME", funcionarios: "3" });
    expect(patch.lead.qualificationDetails).toEqual({
      numberOfLives: "3",
      averageAge: "34",
      cidade: "Niterói",
      beneficiaries: [{ age: 34, relation: "titular" }],
      contato: { plano: "Amil" },
    });
  });

  it("no Lead Ads tira o campo pessoal inteiro e mantém campanha, anúncio e vidas", () => {
    expect(patch.lead.sourceMetadata).toEqual({ campaignName: "Black Friday", adName: "Anúncio 1", field_data: [{ name: "qtd_vidas", values: ["3"] }] });
  });

  it("só mexe nas colunas pessoais: venda, comissão, valores, etapa e dono ficam fora do patch", () => {
    const keys = Object.keys(patch.lead);
    for (const kept of ["monthlyValue", "livesCount", "status", "corretorId", "branchId", "tenantId", "createdAt", "lossCategory", "origem", "sourceCampaign"]) {
      expect(keys).not.toContain(kept);
    }
    expect(patch).not.toHaveProperty("sale");
    expect(patch).not.toHaveProperty("commission");
    expect(Object.keys(patch.beneficiary)).not.toContain("age");
  });

  it("reconhece chave pessoal com prefixo, sufixo ou acento, sem pegar nome de campanha", () => {
    expect(isPersonalKey("CPF do titular")).toBe(true);
    expect(isPersonalKey("telefone2")).toBe(true);
    expect(isPersonalKey("observações")).toBe(true);
    expect(isPersonalKey("campaignName")).toBe(false);
    expect(isPersonalKey("numberOfLives")).toBe(false);
    expect(scrubPersonalJson(null)).toBeNull();
  });
});

describe("anonimização ampliada (26/11)", () => {
  const patch = buildLeadAnonymization({});

  it("documento: sem nome nem comentário; venda e evidência do ERP ficam retidas com o arquivo", () => {
    expect(patch.document).toEqual({ filename: ANONYMIZED_DOCUMENT_FILENAME, description: null, reviewComment: null });
    const plan = planLeadDocumentRemoval([
      { id: "rg", storageKey: "documents/t1/rg.pdf", deletedAt: null },
      { id: "antigo", storageKey: "documents/t1/antigo.pdf", deletedAt: new Date("2026-11-01") },
      { id: "confirmacao", storageKey: "documents/t1/confirmacao.pdf", deletedAt: null },
      { id: "sem-arquivo", storageKey: null, deletedAt: null },
    ], new Set(["confirmacao"]));
    expect(plan.markRemoved).toEqual(["rg", "sem-arquivo"]);
    expect(plan.retained).toEqual(["confirmacao"]);
    expect(plan.filesToDelete).toEqual([{ id: "rg", storageKey: "documents/t1/rg.pdf" }, { id: "antigo", storageKey: "documents/t1/antigo.pdf" }]);
  });

  it("mensagem: a chave do arquivo só sai depois que o arquivo for apagado", () => {
    expect(patch.message).toEqual({ phone: "", body: ANONYMIZED_MESSAGE_TEXT, mediaFilename: null });
  });

  it("cotação e proposta: nome, telefone, vidas pessoais e observação saem; total, plano e idade ficam", () => {
    expect(patch.quote).toEqual({ leadName: ANONYMIZED_HOLDER_NAME, leadPhone: null });
    expect(patch.proposal).toEqual({ leadName: ANONYMIZED_HOLDER_NAME, leadPhone: null });
    expect(anonymizeQuoteRow({ notes: "Ana prefere Amil", lives: [{ name: "Ana", age: 34, cpf: "123" }, { age: 8 }] }))
      .toEqual({ notes: ANONYMIZED_FREE_TEXT, lives: [{ age: 34 }, { age: 8 }] });
    expect(anonymizeQuoteRow({ notes: null, lives: [] })).toEqual({ notes: null, lives: [] });
    expect(anonymizeProposalRow({ title: "Proposta Amil para Ana Souza", notes: "  " }, ["Ana Souza", null]))
      .toEqual({ title: `Proposta Amil para ${ANONYMIZED_HOLDER_NAME}`, notes: null });
    for (const kept of ["totalMonthly", "beneficiaryCount", "status", "validUntil", "convertedSaleId"]) {
      expect(Object.keys(patch.quote)).not.toContain(kept);
      expect(Object.keys(patch.proposal)).not.toContain(kept);
    }
  });

  it("venda: só as anotações livres viram aviso; apólice, valores e vigência ficam", () => {
    const sale = anonymizeSaleRow({ notes: "Ana pagou no Pix, CPF 123", postSaleNotes: "Ligar para a Ana no dia 5" });
    expect(sale).toEqual({ notes: ANONYMIZED_SALE_NOTE_TEXT, postSaleNotes: ANONYMIZED_SALE_NOTE_TEXT });
    expect(anonymizeSaleRow({ notes: null, postSaleNotes: "" })).toEqual({ notes: null, postSaleNotes: null });
    for (const kept of ["policyNumber", "saleValue", "approvedValue", "coverageStartDate", "status", "brokerId"]) expect(Object.keys(sale)).not.toContain(kept);
  });

  it("conversa da IA: resumo e motivo viram aviso e a memória sai", () => {
    expect(anonymizeAiConversationRow({ qualificationSummary: "Ana, 34, diabética", transferReason: null }))
      .toEqual({ qualificationSummary: ANONYMIZED_AI_TEXT, transferReason: null, memory: null });
  });

  it("venda automática: texto e transcrição viram aviso; fatos e decisão perdem o pessoal e o texto livre", () => {
    expect(anonymizeAutoSaleTurnRow({ body: "Oi, sou a Ana", facts: { nome: "Ana", vidas: 3 }, decision: { action: "quote", reply: "Oi Ana!", offerId: "o1" } }))
      .toEqual({ body: ANONYMIZED_AI_TEXT, facts: { vidas: 3 }, decision: { action: "quote", offerId: "o1" } });
    expect(anonymizeAutoSaleTurnRow({ body: null, facts: null, decision: null })).toEqual({ body: null, facts: null, decision: null });
    expect(anonymizeAutoSaleDealRow({ facts: { telefone: "21999", plano: "Amil" }, managerCallReason: "Ana pediu desconto" }))
      .toEqual({ facts: { plano: "Amil" }, managerCallReason: ANONYMIZED_AI_TEXT });
  });

  it("texto livre e troca de nome", () => {
    expect(redactFreeText(undefined, ANONYMIZED_FREE_TEXT)).toBeNull();
    expect(redactNameInText("Sem nome aqui", ["Al", ANONYMIZED_HOLDER_NAME])).toBe("Sem nome aqui");
    expect(scrubConversationJson({ resumo: "x", etapa: "cotacao", itens: [{ resposta: "y", n: 1 }] })).toEqual({ etapa: "cotacao", itens: [{ n: 1 }] });
  });
});

describe("escopo do pedido do titular", () => {
  it("só o diretor, e só na própria empresa", () => {
    expect(checkDataSubjectAccess({ role: "director", tenantId: "t1" }, { tenantId: "t1" })).toEqual({ ok: true });
    expect(checkDataSubjectAccess({ role: "director", tenantId: "t1" }, { tenantId: "t2" })).toEqual({ ok: false, error: "Lead não encontrado." });
    expect(checkDataSubjectAccess({ role: "director", tenantId: "t1" }, null)).toMatchObject({ ok: false });
    for (const role of ["manager", "supervisor", "broker"]) {
      expect(checkDataSubjectAccess({ role, tenantId: "t1" }, { tenantId: "t1" })).toMatchObject({ ok: false, error: "Só o diretor atende pedidos do titular." });
    }
  });
});

describe("confirmação da anonimização", () => {
  it("pede ANONIMIZAR e motivo", () => {
    expect(validateAnonymizeRequest({ confirmation: "anonimizar", reason: "Pedido por e-mail" })).toMatchObject({ ok: false });
    expect(validateAnonymizeRequest({ confirmation: "ANONIMIZAR", reason: "  " })).toEqual({ ok: false, error: "Escreva o motivo do pedido." });
    expect(validateAnonymizeRequest({ confirmation: " ANONIMIZAR ", reason: " Pedido por e-mail " })).toEqual({ ok: true, reason: "Pedido por e-mail" });
    expect(validateAnonymizeRequest({ confirmation: "ANONIMIZAR", reason: "x".repeat(501) })).toMatchObject({ ok: false });
  });

  it("nome do arquivo sem dado pessoal, com o dia de Brasília", () => {
    expect(dataSubjectExportFilename("abcdef123456", new Date("2026-11-27T02:30:00.000Z"))).toBe("titular-abcdef12-2026-11-26.json");
  });
});
