import { describe, expect, it } from "vitest";

import { createUserInput } from "./create-user";
import { classifyExistingTeamIdentity } from "./identity-reuse-policy";

const validInput = {
  name: "Pessoa Corretora",
  phone: "5521999999999",
  role: "broker",
  jobTitle: "broker",
  branchId: "00000000-0000-4000-8000-000000000001",
};

describe("createUserInput", () => {
  it("aceita cadastro manual sem e-mail e normaliza o campo para null", () => {
    const parsed = createUserInput.parse({ ...validInput, email: "" });

    expect(parsed.email).toBeNull();
  });

  it("normaliza e-mail informado e rejeita valor inválido", () => {
    expect(createUserInput.parse({ ...validInput, email: "  PESSOA@EXAMPLE.COM " }).email)
      .toBe("pessoa@example.com");
    expect(createUserInput.safeParse({ ...validInput, email: "email-invalido" }).success)
      .toBe(false);
  });
});

describe("classifyExistingTeamIdentity", () => {
  const identity = { id: "user-1", active: true, status: "active" as const };

  it("permite reutilizar uma identidade ativa sem vínculo no tenant", () => {
    expect(classifyExistingTeamIdentity(identity, null)).toEqual({ kind: "reuse", userId: "user-1" });
  });

  it("mantém o bloqueio quando o e-mail já possui vínculo no tenant", () => {
    expect(classifyExistingTeamIdentity(identity, { id: "membership-1" })).toEqual({ kind: "tenant-conflict" });
  });

  it("não reativa silenciosamente uma identidade desativada", () => {
    expect(classifyExistingTeamIdentity({ ...identity, active: false }, null)).toEqual({ kind: "disabled" });
    expect(classifyExistingTeamIdentity({ ...identity, status: "disabled" }, null)).toEqual({ kind: "disabled" });
  });
});
