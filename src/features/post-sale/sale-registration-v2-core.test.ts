import { describe, expect, it } from "vitest";
import { canUseSaleRegistrationV2, deriveAgeFromBirthDate, leadIdentityFromSources, requiredDocumentsStillMissing, saleRegistrationBlockedReason } from "./sale-registration-v2-core";

describe("sale registration v2 rollout and eligibility", () => {
  const allowed = { enabled: true, isLiteBroker: true, isCurrentBroker: true, status: "documentation_pending", aiSaleRegistrationPending: false, hasActiveSale: false };

  it("keeps the legacy flow when the flag is off or the viewer is outside the broker Lite", () => {
    expect(canUseSaleRegistrationV2({ ...allowed, enabled: false })).toBe(false);
    expect(canUseSaleRegistrationV2({ ...allowed, isLiteBroker: false })).toBe(false);
    expect(canUseSaleRegistrationV2({ ...allowed, isCurrentBroker: false })).toBe(false);
  });

  it("allows AI-converted leads only while registration is pending and blocks finished leads", () => {
    expect(canUseSaleRegistrationV2({ ...allowed, status: "converted", aiSaleRegistrationPending: true })).toBe(true);
    expect(canUseSaleRegistrationV2({ ...allowed, status: "converted", aiSaleRegistrationPending: false })).toBe(false);
    expect(canUseSaleRegistrationV2({ ...allowed, status: "lost", aiSaleRegistrationPending: true })).toBe(false);
    expect(canUseSaleRegistrationV2({ ...allowed, hasActiveSale: true })).toBe(false);
  });
});

describe("identity details used for the sale holder", () => {
  it("reads titular birth date, age and CPF from direct form fields", () => {
    expect(leadIdentityFromSources({
      formData: { dataNascimento: "14/03/1988", cpf: "529.982.247-25" },
      qualificationDetails: { idade: 38 },
    }, new Date("2026-11-12T12:00:00Z"))).toEqual({ birthDate: "1988-03-14", age: 38, cpf: "52998224725" });
  });

  it("keeps direct form age when no date was supplied and never invents an invalid date or CPF", () => {
    expect(leadIdentityFromSources({ formData: { idade: "42" }, qualificationDetails: { cpf: "529.982.247-25" } })).toEqual({ birthDate: null, age: 42, cpf: null });
    expect(leadIdentityFromSources({ formData: { nascimento: "31/02/1988" } }).birthDate).toBeNull();
  });

  it("never copies CPF or age from dependent or nested analysis data", () => {
    expect(leadIdentityFromSources({
      formData: {
        dependents: [{ cpf: "529.982.247-25", age: 42 }],
        cadastro: { cpfTitular: "529.982.247-25", idade: 42 },
      },
      qualificationDetails: { saleDetails: { fields: [{ field: "holderAge", value: "42 anos" }, { field: "cpf", value: "529.982.247-25" }] } },
    })).toEqual({ birthDate: null, age: null, cpf: null });
  });

  it("accepts explicitly named titular identity fields only at the form root", () => {
    expect(leadIdentityFromSources({ formData: { cpfTitular: "529.982.247-25", holderAge: "42 anos" } }))
      .toEqual({ birthDate: null, age: 42, cpf: "52998224725" });
  });

  it("derives age from a valid birth date", () => {
    expect(deriveAgeFromBirthDate("2000-11-13", new Date("2026-11-12T12:00:00Z"))).toBe(25);
  });
});

describe("required documents checklist", () => {
  it("counts missing shared and per-beneficiary documents until they are approved", () => {
    const input = {
      requirements: [
        { id: "confirmation", required: true, appliesPerBeneficiary: false },
        { id: "identity", required: true, appliesPerBeneficiary: true },
      ],
      beneficiaries: [{ id: "holder" }, { id: "dependent" }],
      documents: [
        { requirementId: "confirmation", beneficiaryId: null, status: "pending" },
        { requirementId: "identity", beneficiaryId: "holder", status: "approved" },
      ],
    };
    expect(requiredDocumentsStillMissing(input)).toEqual(["confirmation", "identity:dependent"]);
  });
});

describe("sale registration idempotency rules", () => {
  it("allows the AI pending marker once, then blocks a repeat when the active sale exists", () => {
    expect(saleRegistrationBlockedReason({ status: "converted", aiRegistrationPending: true, hasActiveSale: false })).toBeNull();
    expect(saleRegistrationBlockedReason({ status: "converted", aiRegistrationPending: true, hasActiveSale: true })).toBe("already_registered");
    expect(saleRegistrationBlockedReason({ status: "converted", aiRegistrationPending: false, hasActiveSale: false })).toBe("already_registered");
  });

  it("never registers a lost lead", () => {
    expect(saleRegistrationBlockedReason({ status: "lost", aiRegistrationPending: true, hasActiveSale: false })).toBe("lost");
  });
});
