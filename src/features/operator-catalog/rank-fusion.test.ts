import { describe, expect, it } from "vitest";

import { applyRerank, fuseRankings } from "./rank-fusion";

const chunk = (chunkId: string, extra: Partial<{ keywordHits: number; semanticDistance: number | null }> = {}) => ({
  chunkId,
  keywordHits: extra.keywordHits ?? 0,
  semanticDistance: extra.semanticDistance ?? null,
  score: 0,
});

describe("fuseRankings", () => {
  it("puts first a chunk found by several searches", () => {
    const byTerm = [chunk("a", { keywordHits: 3 }), chunk("b"), chunk("c")];
    const byMeaning = [chunk("c", { semanticDistance: 0.3 }), chunk("d"), chunk("a")];
    const fused = fuseRankings([byTerm, byMeaning], 10);
    expect(fused.map((item) => item.chunkId).slice(0, 2)).toEqual(["a", "c"]);
    expect(fused).toHaveLength(4);
  });

  it("keeps the best evidence of every search for the relevance guard", () => {
    const fused = fuseRankings([[chunk("a", { keywordHits: 1 })], [chunk("a", { semanticDistance: 0.4 })], [chunk("a", { keywordHits: 2, semanticDistance: 0.6 })]], 5);
    expect(fused[0]).toMatchObject({ keywordHits: 2, semanticDistance: 0.4 });
  });

  it("cuts to the limit", () => {
    expect(fuseRankings([[chunk("a"), chunk("b"), chunk("c")]], 2).map((item) => item.chunkId)).toEqual(["a", "b"]);
  });
});

describe("applyRerank", () => {
  it("follows the chosen order and ignores repeated or unknown numbers", () => {
    expect(applyRerank(["x", "y", "z"], [3, 3, 9, 1, 0], 5)).toEqual(["z", "x"]);
    expect(applyRerank(["x", "y", "z"], [2, 1, 3], 2)).toEqual(["y", "x"]);
  });
});
