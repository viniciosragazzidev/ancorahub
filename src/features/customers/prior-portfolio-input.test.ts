import { describe, expect, it } from "vitest";

import {
  collectFieldErrors,
  isPriorContractRenewalAttention,
  priorClientSchema,
  priorContractPending,
} from "./prior-portfolio-input";

describe("Cliente que já possuo: entrada validada no servidor", () => {
  it("aceita o formulário curto e deixa o desconhecido como nulo", () => {
    const parsed = priorClientSchema.parse({ nome: " Ana Prévia ", telefone: "(11) 98888-7777", email: "", observacao: "", contracts: [{}] });
    expect(parsed).toMatchObject({ nome: "Ana Prévia", telefone: "11988887777", email: null, observacao: null });
    expect(parsed.contracts[0]).toEqual({ productType: "unknown", carrierName: null, coverageStartDate: null, renewalDate: null, status: "unknown" });
  });

  it("recusa telefone curto, data inválida, renovação antes da vigência e mais de cinco contratos", () => {
    const result = priorClientSchema.safeParse({
      nome: "A",
      telefone: "123",
      contracts: [
        { coverageStartDate: "2026-02-30" },
        { coverageStartDate: "2026-05-01", renewalDate: "2026-04-01" },
      ],
    });
    expect(result.success).toBe(false);
    const errors = collectFieldErrors(result.error!);
    expect(Object.keys(errors)).toEqual(expect.arrayContaining(["nome", "telefone", "contracts.0.coverageStartDate", "contracts.1.renewalDate"]));
    expect(priorClientSchema.safeParse({ nome: "Ana", telefone: "11988887777", contracts: Array.from({ length: 6 }, () => ({})) }).success).toBe(false);
  });

  it("não aceita valor, comissão ou produto fora da lista", () => {
    const parsed = priorClientSchema.parse({ nome: "Ana", telefone: "11988887777", contracts: [{ productType: "PF", saleValue: 999, commission: 10 }] });
    expect(parsed.contracts[0]).not.toHaveProperty("saleValue");
    expect(parsed.contracts[0]).not.toHaveProperty("commission");
    expect(priorClientSchema.safeParse({ nome: "Ana", telefone: "11988887777", contracts: [{ productType: "vida" }] }).success).toBe(false);
  });

  it("renovação entra em atenção só com contrato ativo e data entre hoje e 30 dias (DEC-180)", () => {
    const today = "2026-11-13";
    expect(isPriorContractRenewalAttention({ status: "active", renewalDate: "2026-11-13" }, today)).toBe(true);
    expect(isPriorContractRenewalAttention({ status: "active", renewalDate: "2026-12-13" }, today)).toBe(true);
    expect(isPriorContractRenewalAttention({ status: "active", renewalDate: "2026-12-14" }, today)).toBe(false);
    expect(isPriorContractRenewalAttention({ status: "active", renewalDate: "2026-11-12" }, today)).toBe(false);
    expect(isPriorContractRenewalAttention({ status: "unknown", renewalDate: "2026-11-20" }, today)).toBe(false);
    expect(isPriorContractRenewalAttention({ status: "active", renewalDate: null }, today)).toBe(false);
  });

  it("lista as pendências do que não foi informado", () => {
    expect(priorContractPending({ productType: "unknown", carrierName: null, coverageStartDate: null, renewalDate: null, status: "unknown" }))
      .toEqual(["produto", "operadora", "início da vigência", "renovação", "situação"]);
    expect(priorContractPending({ productType: "PF", carrierName: "Operadora X", coverageStartDate: "2025-01-01", renewalDate: "2026-01-01", status: "active" })).toEqual([]);
  });
});
