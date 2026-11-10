import { describe, expect, it } from "vitest";

import {
  ageOnDate,
  buildSaleDetailsTranscript,
  canViewSaleDetails,
  extractCpfFromMessages,
  extractCpfFromSources,
  extractCpfFromText,
  hasConfirmedSaleEvidence,
  isValidCpf,
  maskCpf,
  shouldShowSaleDetailsCard,
  validateAndMergeSaleDetails,
} from "./sale-details-core";

describe("Dados da venda", () => {
  const transcript = [
    { id: "old-pix", sender: "customer" as const, content: "Já fiz o pagamento via pix da adesão", timestamp: new Date("2026-11-04T11:36:00.000Z") },
    { id: "broker", sender: "broker" as const, content: "Vou conferir o comprovante", timestamp: new Date("2026-11-04T11:38:00.000Z") },
    { id: "recent", sender: "customer" as const, content: "Obrigada", timestamp: new Date("2026-11-10T12:00:00.000Z") },
  ];

  it("inclui fatos antigos da conversa completa com data, sem limitar à janela recente", () => {
    const text = buildSaleDetailsTranscript(transcript);
    expect(text).toContain("Já fiz o pagamento via pix da adesão");
    expect(text).toContain("04/11/2026");
  });

  it("só aceita extrações com evidência literal localizada e preserva dados anteriores", () => {
    const result = validateAndMergeSaleDetails({
      previous: { fields: [{ field: "plan", value: "Plano anterior", evidenceQuote: "plano antigo", source: "IA", requiresConfirmation: true }] },
      extracted: { fields: [
        { field: "paymentDate", value: "04/11/2026", evidenceQuote: "pagamento via pix da adesão" },
        { field: "monthlyValue", value: "R$ 500", evidenceQuote: "a mensalidade será R$ 500" },
        { field: "operator", value: "CPF 529.982.247-25", evidenceQuote: "Já fiz o pagamento via pix da adesão" },
      ] },
      messages: transcript,
    });

    expect(result.fields).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: "plan", value: "Plano anterior", requiresConfirmation: true }),
      expect.objectContaining({ field: "paymentDate", value: "04/11/2026", source: "IA", evidenceMessageId: "old-pix", evidenceSender: "Cliente" }),
      expect.objectContaining({ field: "operator", value: "CPF [cpf]" }),
    ]));
    expect(result.fields.some((field) => field.field === "monthlyValue")).toBe(false);
  });

  it("remove CPF legado dos valores de vendas anteriores antes de reaproveitá-los", () => {
    const result = validateAndMergeSaleDetails({
      previous: { fields: [{ field: "operator", value: "CPF 529.982.247-25", source: "IA" }] },
      extracted: { fields: [] },
      messages: transcript,
    });

    expect(result.fields[0]?.value).toBe("CPF [cpf]");
  });

  it("extrai CPF válido sem passá-lo ao modelo e só revela os dígitos ao diretor", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(extractCpfFromText("Meu CPF é 529.982.247-25")).toBe("529.982.247-25");
    expect(extractCpfFromMessages([{ content: "CPF 52998224725" }])).toBe("529.982.247-25");
    expect(extractCpfFromSources({ cadastro: { cpfTitular: "529.982.247-25" } })).toBe("529.982.247-25");
    expect(maskCpf("529.982.247-25", false)).toBe("***.***.***-25");
    expect(maskCpf("529.982.247-25", true)).toBe("529.982.247-25");
    const safeTranscript = buildSaleDetailsTranscript([{ id: "cpf", sender: "customer", content: "Meu CPF é 529.982.247-25", timestamp: new Date("2026-11-10T12:00:00.000Z") }]);
    expect(safeTranscript).toContain("[cpf]");
    expect(safeTranscript).not.toContain("529.982.247-25");
  });

  it("calcula idade e restringe a visualização ao papel e escopo certos", () => {
    expect(ageOnDate("2000-11-11", new Date("2026-11-10T12:00:00.000Z"))).toBe(25);
    expect(canViewSaleDetails({ role: "director", userId: "d", branchId: null, leadBranchId: "unit-a", leadOwnerId: "b" })).toBe(true);
    expect(canViewSaleDetails({ role: "manager", userId: "m", branchId: "unit-a", leadBranchId: "unit-a", leadOwnerId: "b" })).toBe(true);
    expect(canViewSaleDetails({ role: "manager", userId: "m", branchId: "unit-a", leadBranchId: "unit-b", leadOwnerId: "b" })).toBe(false);
    expect(canViewSaleDetails({ role: "broker", userId: "b", branchId: null, leadBranchId: "unit-a", leadOwnerId: "b" })).toBe(true);
    expect(canViewSaleDetails({ role: "broker", userId: "other", branchId: null, leadBranchId: "unit-a", leadOwnerId: "b" })).toBe(false);
    expect(shouldShowSaleDetailsCard("documentation_pending", false)).toBe(true);
    expect(shouldShowSaleDetailsCard("negotiation", false)).toBe(false);
    expect(shouldShowSaleDetailsCard("negotiation", true)).toBe(true);
    expect(hasConfirmedSaleEvidence("confirmed")).toBe(true);
    expect(hasConfirmedSaleEvidence("likely")).toBe(false);
    expect(hasConfirmedSaleEvidence("no")).toBe(false);
  });
});
