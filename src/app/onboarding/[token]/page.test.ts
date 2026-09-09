import { describe, it, expect } from "vitest";
import { extractRealToken } from "./page";

describe("extractRealToken", () => {
  it("remove o prefixo codificado %7B%7Bid%7D%7D do token", () => {
    const buggyToken =
      "%7B%7Bid%7D%7DJ635bUieZdUClQBfjZBqMVp4jlRMp2obsQevx7Aqy6A";
    const expected = "J635bUieZdUClQBfjZBqMVp4jlRMp2obsQevx7Aqy6A";

    expect(extractRealToken(buggyToken)).toBe(expected);
  });

  it("funciona com qualquer caractere inicial depois do prefixo", () => {
    const tokenA = "%7B%7Bid%7D%7DAbc123";
    expect(extractRealToken(tokenA)).toBe("Abc123");

    const tokenZ = "%7B%7Bid%7D%7DZyx999";
    expect(extractRealToken(tokenZ)).toBe("Zyx999");
  });

  it("retorna o token intacto quando não tem o prefixo", () => {
    const normalToken = "J635bUieZdUClQBfjZBqMVp4jlRMp2obsQevx7Aqy6A";
    expect(extractRealToken(normalToken)).toBe(normalToken);
  });

  it("retorna string vazia se o token for apenas o prefixo", () => {
    expect(extractRealToken("%7B%7Bid%7D%7D")).toBe("");
  });
});
