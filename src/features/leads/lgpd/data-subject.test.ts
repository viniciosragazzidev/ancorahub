import { describe, expect, it } from "vitest";

import {
  ANONYMIZED_HOLDER_NAME,
  buildLeadAnonymization,
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
