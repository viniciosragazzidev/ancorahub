import { describe, expect, it } from "vitest";
import { assertImplantationTransition, assertIndependentReview, financialDirection, implantationInputSchema, parseMoneyCents } from "./contracts";

const confirmation = () => implantationInputSchema.parse({ leadId: "synthetic-lead", expectedVersion: 0, status: "implanted", reference: "protocol-1", policyNumber: "policy-1", coverageStartsOn: "2026-11-01", evidenceDocumentId: "70f1a400-f777-41c4-a6f2-220f2cccbbb1", reason: "Operadora conferida" });

describe("ERP facts and financial input", () => {
  it.each([["0,01", 1], ["19.90", 1990], ["1.234,56", 123456], ["R$ 2.100,50", 210050], ["999999999.99", 99999999999]])("parses %s without multiplying a binary decimal", (value, expected) => {
    expect(parseMoneyCents(String(value))).toBe(expected);
  });
  it.each(["0", "-10", "1.005", "1.2,34", "1,234,56", "NaN", "Infinity", "1e3", "1000000001", "1.000.000.000.000,00"]) ("rejects ambiguous or unsupported money %s", (value) => {
    expect(() => parseMoneyCents(value)).toThrow();
  });
  it("never treats the client's premium as the agency's cash", () => {
    expect(financialDirection("client_premium")).toBe("external");
    expect(financialDirection("agency_receivable")).toBe("in");
    expect(financialDirection("broker_commission")).toBe("out");
  });
  it("requires a different approver even for the same role or privileged actor", () => {
    expect(() => assertIndependentReview("director-a", "director-a")).toThrow(/outra pessoa/);
    expect(() => assertIndependentReview("director-b", "director-a")).not.toThrow();
  });
});

describe("implantation evidence and transitions", () => {
  it("requires coverage, policy and documentary evidence for an implanted contract", () => {
    expect(() => assertImplantationTransition("review", confirmation())).not.toThrow();
    for (const input of [{ ...confirmation(), evidenceDocumentId: null }, { ...confirmation(), policyNumber: "" }, { ...confirmation(), coverageStartsOn: null }]) {
      expect(() => assertImplantationTransition("review", input)).toThrow();
    }
  });
  it("does not skip document collection or silently reopen a completed fact", () => {
    expect(() => assertImplantationTransition("awaiting_documents", confirmation())).toThrow();
    expect(() => assertImplantationTransition("implanted", { ...confirmation(), status: "review", reason: "" })).toThrow();
    expect(() => assertImplantationTransition("implanted", { ...confirmation(), status: "review", reason: "Revisar resposta da operadora" })).not.toThrow();
  });
  it("rejects invalid dates and injected authority fields", () => {
    expect(implantationInputSchema.safeParse({ ...confirmation(), coverageStartsOn: "2026-02-30" }).success).toBe(false);
    expect(implantationInputSchema.safeParse({ ...confirmation(), tenantId: "another-company" }).success).toBe(false);
  });
});
