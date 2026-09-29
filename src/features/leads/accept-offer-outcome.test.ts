import { describe, expect, it } from "vitest";

import { resolveLeadAcceptOutcome } from "./accept-offer-outcome";

const accepted = { corretorId: "broker-1", assignmentSource: "whatsapp_offer_accepted" };

describe("CRM lead acceptance outcome", () => {
  it("confirms the broker when the offer was won", () => {
    expect(resolveLeadAcceptOutcome({ processed: true, won: true }, accepted, "broker-1")).toEqual({ ok: true });
  });

  it("treats a repeated click on an accepted lead as confirmed", () => {
    expect(resolveLeadAcceptOutcome({ processed: false, reason: "offer_not_found" }, accepted, "broker-1")).toEqual({ ok: true });
    expect(resolveLeadAcceptOutcome({ processed: true, won: false, reason: "already_accepted" }, accepted, "broker-1")).toEqual({ ok: true });
  });

  it("does not confirm a provisional owner whose offer is no longer acceptable", () => {
    const outcome = resolveLeadAcceptOutcome(
      { processed: false, reason: "offer_not_found" },
      { corretorId: "broker-1", assignmentSource: "automatic_offer" },
      "broker-1",
    );
    expect(outcome.ok).toBe(false);
  });

  it("reports expiry and leads taken by another broker", () => {
    expect(resolveLeadAcceptOutcome({ processed: true, won: false, reason: "expired" }, { corretorId: "broker-2", assignmentSource: "automatic_offer" }, "broker-1"))
      .toEqual({ ok: false, error: "O prazo para aceitar este lead terminou." });
    expect(resolveLeadAcceptOutcome({ processed: true, won: false, reason: "already_assigned" }, accepted, "broker-2"))
      .toEqual({ ok: false, error: "Este lead já foi assumido por outro corretor." });
  });
});
