import { describe, expect, it } from "vitest";

import { isNegotiationsDevPreview } from "./negotiations-dev-preview";

describe("isNegotiationsDevPreview", () => {
  it("permite somente a rota de fixture em desenvolvimento", () => {
    expect(isNegotiationsDevPreview("/dev/negociacoes-preview", "development")).toBe(true);
    expect(isNegotiationsDevPreview("/negociacoes", "development")).toBe(false);
    expect(isNegotiationsDevPreview("/dev/negociacoes-preview", "production")).toBe(false);
  });
});
