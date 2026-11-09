import { describe, expect, it } from "vitest";
import { isPostSaleAlertOpen, postSaleAlertIdempotencyKey, postSaleAlertReasons } from "./alert-rules";

describe("post-sale alert rules", () => {
  it("creates separate reasons for no contact, low rating and a request for help", () => {
    expect(postSaleAlertReasons({
      outcome: "no_contact",
      rating: 2,
      answers: { wantsHelp: true },
    })).toEqual(["no_contact", "low_rating", "wants_help"]);
  });

  it("recognizes a bad service outcome or a negative answer", () => {
    expect(postSaleAlertReasons({ outcome: "bad_service", rating: null, answers: {} })).toEqual(["bad_service"]);
    expect(postSaleAlertReasons({ outcome: null, rating: null, answers: { sentiment: "negative" } })).toEqual(["bad_service"]);
  });

  it("alerts only for ratings at or below two and an explicit request for help", () => {
    expect(postSaleAlertReasons({ outcome: null, rating: 3, answers: {} })).toEqual([]);
    expect(postSaleAlertReasons({ outcome: null, rating: 2, answers: {} })).toEqual(["low_rating"]);
    expect(postSaleAlertReasons({ outcome: null, rating: null, answers: { wantsHelp: true } })).toEqual(["wants_help"]);
  });

  it("keeps one idempotency key per survey, reason and recipient", () => {
    expect(postSaleAlertIdempotencyKey("survey-1", "low_rating", "user-1")).toBe("post-sale-alert:survey-1:low_rating:user-1");
    expect(postSaleAlertIdempotencyKey("survey-1", "low_rating", "user-2")).not.toBe(postSaleAlertIdempotencyKey("survey-1", "low_rating", "user-1"));
  });

  it("counts only alerts that have not been treated", () => {
    const state = { outcome: "no_contact", rating: null, answers: {}, alertsHandledAt: null };
    expect(isPostSaleAlertOpen(state)).toBe(true);
    expect(isPostSaleAlertOpen({ ...state, alertsHandledAt: new Date() })).toBe(false);
    expect(isPostSaleAlertOpen({ ...state, outcome: "ok" })).toBe(false);
  });
});

describe("alerta repetível por mensagem", () => {
  it("urgência de saúde e pedido de retomar notificam de novo a cada mensagem; os outros não", async () => {
    const { postSaleAlertIdempotencyKey } = await import("./alert-rules");
    expect(postSaleAlertIdempotencyKey("s1", "health_urgency", "u1", "m1")).not.toBe(postSaleAlertIdempotencyKey("s1", "health_urgency", "u1", "m2"));
    expect(postSaleAlertIdempotencyKey("s1", "wants_resume", "u1", "m1")).toBe("post-sale-alert:s1:wants_resume:u1:m1");
    expect(postSaleAlertIdempotencyKey("s1", "no_contact", "u1", "m1")).toBe("post-sale-alert:s1:no_contact:u1");
  });
});
