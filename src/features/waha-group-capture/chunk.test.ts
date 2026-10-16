import { describe, expect, it } from "vitest";

import { chunkOperatorText } from "./chunk";

describe("chunkOperatorText", () => {
  it("keeps short paragraphs together up to the size limit", () => {
    const chunks = chunkOperatorText("Plano A: R$ 250,00\n\nPlano B: R$ 310,00", 1200);
    expect(chunks).toEqual(["Plano A: R$ 250,00\nPlano B: R$ 310,00"]);
  });

  it("splits when the next paragraph would overflow the limit", () => {
    const first = "a".repeat(80);
    const second = "b".repeat(80);
    expect(chunkOperatorText(`${first}\n\n${second}`, 100)).toEqual([first, second]);
  });

  it("breaks a long table by line and never changes a value", () => {
    const table = Array.from({ length: 40 }, (_, i) => `Faixa ${i}: R$ ${(250 + i).toFixed(2)}`).join("\n");
    const chunks = chunkOperatorText(table, 200);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join("\n").split("\n")).toEqual(table.split("\n"));
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(200);
  });

  it("returns nothing for blank text", () => {
    expect(chunkOperatorText("   \n\n  ")).toEqual([]);
  });
});
