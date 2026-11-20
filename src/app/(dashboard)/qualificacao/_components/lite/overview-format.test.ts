import { describe, expect, it } from "vitest";

import { brl, n } from "./overview-tab-lite";

describe("números da Qualificação IA", () => {
  it("usam o formato brasileiro", () => {
    expect(brl(6057.7).replace(/\s/g, " ")).toBe("R$ 6.057,70");
    expect(brl(1.1).replace(/\s/g, " ")).toBe("R$ 1,10");
    expect(n(8921)).toBe("8.921");
  });
});
