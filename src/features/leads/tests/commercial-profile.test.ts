import { describe, expect, it } from "vitest";
import { normalizeCnpj } from "../manual-create";

describe("commercial PJ profile", () => {
  it("normalizes a formatted CNPJ before tenant-scoped duplicate lookup", () => {
    expect(normalizeCnpj("12.345.678/0001-90")).toBe("12345678000190");
  });

  it("rejects incomplete CNPJ values", () => {
    expect(normalizeCnpj("12.345.678/0001")).toBeNull();
  });
});
