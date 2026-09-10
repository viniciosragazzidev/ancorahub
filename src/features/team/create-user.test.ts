import { describe, expect, it } from "vitest";

import { createUserInput } from "./create-user";

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
