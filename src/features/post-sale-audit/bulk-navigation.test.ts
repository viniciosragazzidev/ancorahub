import { describe, expect, it } from "vitest";
import { buildPostSaleAudienceHref } from "./bulk-navigation";

describe("post-sale bulk navigation", () => {
  it("deduplicates leads and opens the manual campaign with them selected", () => {
    expect(buildPostSaleAudienceHref(["lead-1", "lead-2", "lead-1"])).toBe("/equipe/pos-venda?leadIds=lead-1%2Clead-2");
  });

  it("rejects empty or oversized selections", () => {
    expect(buildPostSaleAudienceHref([])).toBeNull();
    expect(buildPostSaleAudienceHref(Array.from({ length: 301 }, (_, index) => `lead-${index}`))).toBeNull();
  });
});
