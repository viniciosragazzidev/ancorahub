import { describe, expect, it } from "vitest";
import { createEmptyMemory, extractFieldsFromMessage } from "./memory";

const planOf = (message: string) => extractFieldsFromMessage(message, createEmptyMemory(), "m1").planType?.value ?? null;

describe("resposta curta ao tipo de plano (29/10, Paula)", () => {
  it("entende as formas de 'só pra mim' como individual", () => {
    for (const message of ["Só meu", "So meu", "Apenas pra mim", "Um plano so meu", "Só para mim", "pra mim"]) {
      expect(planOf(message), message).toBe("individual");
    }
  });

  it("\"só eu mesmo queria saber\" não é resposta de plano", () => {
    expect(planOf("só eu mesmo queria saber o preço")).toBeNull();
  });

  it("família ou empresa na mesma frase vence o 'pra mim'", () => {
    expect(planOf("pra mim e minha família")).toBe("familiar");
    expect(planOf("Pra família")).toBe("familiar");
    expect(planOf("Para minha empresa")).toBe("empresarial");
  });

  it("não muda as respostas de CNPJ", () => {
    expect(planOf("Não tenho CNPj")).toBeNull();
    expect(planOf("tenho cnpj")).toBe("empresarial");
    expect(planOf("sou MEI")).toBe("empresarial");
  });
});
