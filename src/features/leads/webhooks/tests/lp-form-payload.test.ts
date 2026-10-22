import { describe, expect, it } from "vitest";

import { lpFormPayloadSchema } from "../schemas/lp-form-payload.schema";

const validPayload = {
  nome: "Maria da Silva",
  telefone: "+55 (11) 99999-9999",
};

describe("lpFormPayloadSchema", () => {
  it("accepts the minimum landing page contract", () => {
    expect(lpFormPayloadSchema.safeParse(validPayload).success).toBe(true);
  });

  it("accepts optional contact and campaign fields", () => {
    const result = lpFormPayloadSchema.safeParse({
      ...validPayload,
      email: "MARIA@EXAMPLE.COM",
      plano_interesse: "Plano familiar",
      receivedAt: "2026-07-20T12:00:00.000Z",
    });

    expect(result.success).toBe(true);
  });

  it("keeps a lead without name, and rejects a short phone and an invalid email", () => {
    const withoutName = lpFormPayloadSchema.safeParse({ telefone: validPayload.telefone });
    expect(withoutName.success && withoutName.data.nome).toBe("Lead sem nome");
    expect(lpFormPayloadSchema.safeParse({ ...validPayload, nome: "h" }).success && lpFormPayloadSchema.safeParse({ ...validPayload, nome: "h" }).data?.nome).toBe("Lead sem nome");
    expect(lpFormPayloadSchema.safeParse({ nome: validPayload.nome, telefone: "123" }).success).toBe(false);
    expect(lpFormPayloadSchema.safeParse({ ...validPayload, email: "not-an-email" }).success).toBe(false);
  });

  it("rejects tenant, branch, and administrative fields supplied by the browser", () => {
    for (const forbiddenField of [
      "tenantId",
      "branchId",
      "branchExternalId",
      "corretorId",
      "assignedUserId",
      "status",
    ]) {
      expect(lpFormPayloadSchema.safeParse({ ...validPayload, [forbiddenField]: "spoofed" }).success).toBe(false);
    }
  });

  it("keeps the honeypot explicit and defaults it to an empty value", () => {
    const parsed = lpFormPayloadSchema.parse(validPayload);
    expect(parsed.website).toBe("");
    expect(lpFormPayloadSchema.safeParse({ ...validPayload, website: "bot-value" }).success).toBe(true);
  });

  it("rejects oversized customer-controlled text", () => {
    // An oversized name is cut, not rejected: the lead still gets in.
    expect(lpFormPayloadSchema.safeParse({ ...validPayload, nome: "a".repeat(161) }).data?.nome).toHaveLength(160);
    expect(lpFormPayloadSchema.safeParse({ ...validPayload, plano_interesse: "a".repeat(161) }).success).toBe(false);
  });
});
