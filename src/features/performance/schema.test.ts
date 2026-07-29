import { describe, expect, it } from "vitest";
import { awardInputSchema, resetSeasonSchema, seasonInputSchema } from "./schema";

describe("performance season inputs", () => {
  it("rejects a season that ends before it starts", () => {
    expect(seasonInputSchema.safeParse({ name: "Julho", startsAt: "2026-07-31", endsAt: "2026-07-01", activate: false }).success).toBe(false);
  });

  it("accepts a reset without deleting or accepting an unbounded reason", () => {
    expect(resetSeasonSchema.safeParse({ name: "Agosto 2026", reason: "Novo ciclo mensal" }).success).toBe(true);
  });

  it("requires a valid season and rank for an award", () => {
    expect(awardInputSchema.safeParse({ seasonId: "not-a-season", rankPosition: 0, title: "", rewardType: "bonus" }).success).toBe(false);
  });
});
