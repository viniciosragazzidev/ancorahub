import { describe, expect, it } from "vitest";

import { formatShowingRange } from "./page-footer-summary";

describe("formatShowingRange", () => {
  it("mostra a faixa da página e o total com separador de milhar", () => {
    expect(formatShowingRange({ page: 1, pageSize: 20, total: 1240, noun: "leads" })).toBe("Mostrando 1–20 de 1.240 leads");
    expect(formatShowingRange({ page: 62, pageSize: 20, total: 1240, noun: "leads" })).toBe("Mostrando 1.221–1.240 de 1.240 leads");
  });
  it("lista curta e vazia", () => {
    expect(formatShowingRange({ page: 1, pageSize: 20, total: 7, noun: "pessoas" })).toBe("Mostrando 1–7 de 7 pessoas");
    expect(formatShowingRange({ page: 1, pageSize: 20, total: 0, noun: "leads" })).toBe("0 leads");
  });
});
