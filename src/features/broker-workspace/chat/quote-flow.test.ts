import { describe, expect, it } from "vitest";

import type { ChatBlock } from "@/components/chat/types";

import { applyQuoteChoice, chosenPlanBlocks, nextQuoteBlocks, parseAges, quoteAwaiting, quoteProgress, quoteResults, quoteSummaryText, type QuoteAnswers } from "./quote-flow";

const complete: QuoteAnswers = { profile: "family", ages: [35, 32, 8], region: "rj-capital", accommodation: "ward", copayment: "partial", coverage: "regional" };

function question(blocks: ChatBlock[]) {
  const block = blocks.find((item) => item.type === "question");
  if (!block || block.type !== "question") throw new Error("no question");
  return block;
}

describe("quote flow", () => {
  it("asks one thing at a time, in order", () => {
    let answers: QuoteAnswers = {};
    expect(question(nextQuoteBlocks(answers)).id).toBe("q-profile");
    answers = applyQuoteChoice(answers, "profile:family")!;
    expect(quoteAwaiting(answers)).toBe("ages");
    expect(nextQuoteBlocks(answers)[0]).toMatchObject({ type: "assistant", id: "a-ages" });
    answers = { ...answers, ages: [35, 32] };
    expect(question(nextQuoteBlocks(answers)).id).toBe("q-region");
    answers = applyQuoteChoice(applyQuoteChoice(applyQuoteChoice(applyQuoteChoice(answers, "region:baixada")!, "accommodation:ward")!, "copayment:none")!, "coverage:state")!;
    expect(quoteAwaiting(answers)).toBe("done");
    expect(quoteProgress(answers)).toEqual({ title: "Montando a cotação", done: 6, total: 6 });
  });

  it("asks the profession for adhesion and resets ages when the profile changes", () => {
    const adhesion = applyQuoteChoice({ ages: [30] }, "profile:adhesion")!;
    expect(adhesion.ages).toBeUndefined();
    expect(quoteAwaiting(adhesion)).toBe("entity");
    expect(applyQuoteChoice({}, "region:mars")).toBeNull();
  });

  it("reads ages from free text and checks the count for the profile", () => {
    expect(parseAges("35, 32 e 8", "family")).toEqual({ ages: [35, 32, 8] });
    expect(parseAges("trinta", "family")).toHaveProperty("error");
    expect(parseAges("40", "pme")).toHaveProperty("error");
    expect(parseAges("40, 41", "individual")).toHaveProperty("error");
    expect(parseAges("130", "individual")).toHaveProperty("error");
  });

  it("shows the 3 cheapest plans and lets the broker pick one", () => {
    const results = quoteResults(complete);
    expect(results.length).toBeGreaterThan(0);
    expect(results.map((result) => result.monthly)).toEqual([...results.map((result) => result.monthly)].sort((a, b) => a - b));
    const blocks = nextQuoteBlocks(complete);
    const list = blocks.find((block) => block.type === "list");
    expect(list && list.type === "list" ? list.items.length : 0).toBe(Math.min(3, results.length));
    const choices = question(blocks).choices;
    expect(choices[0]?.action).toEqual({ kind: "local", value: `plan:${results[0]!.plan.id}` });
    expect(choices.at(-1)?.action).toEqual({ kind: "href", href: "/cotacao?completo=1" });
  });

  it("gives PME with 2+ lives the 5% discount of the full simulator", () => {
    const pme = { ...complete, profile: "pme" as const };
    const family = quoteResults({ ...pme, profile: "family" });
    const withDiscount = quoteResults(pme);
    const same = withDiscount.find((result) => result.plan.id === family[0]!.plan.id)!;
    expect(same.monthly).toBeCloseTo(Math.round(same.pricing.monthlyTotal * 0.95 * 100) / 100, 2);
  });

  it("presents the chosen plan with the send options and a client-ready summary", () => {
    const [first] = quoteResults(complete);
    const blocks = chosenPlanBlocks(complete, first!.plan.id, 3);
    expect(blocks[0]).toMatchObject({ type: "facts", id: "f-plan-3" });
    expect(question(blocks).choices.map((choice) => choice.id)).toEqual(["whatsapp", "copy", "other", "restart"]);
    const text = quoteSummaryText(complete, first!);
    expect(text).toContain("3 vidas");
    expect(text).not.toContain("(exemplo)");
    expect(text).not.toContain("—");
  });

  it("says when nothing fits", () => {
    const blocks = nextQuoteBlocks({ ...complete, region: "other", coverage: "national", copayment: "none", accommodation: "private" });
    if (quoteResults({ ...complete, region: "other", coverage: "national", copayment: "none", accommodation: "private" }).length === 0) {
      expect(blocks[0]).toMatchObject({ id: "a-empty" });
    } else {
      expect(blocks[0]).toMatchObject({ id: "a-results" });
    }
  });
});
