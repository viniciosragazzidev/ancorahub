import { describe, expect, it } from "vitest";
import { assertReferralTransition, availableReferralStatuses, isConvertedLead, normalizeReferralPhone, referralFiltersSchema, referralInputSchema } from "./referrals";

const base = { status: "registered" as const, consent: false, leadId: null };
const input = { requestId: crypto.randomUUID(), referrerName: "Ana", referrerUserId: null, referrerContact: "", channel: "cliente", referredName: "Bruno", referredPhone: "(21) 99999-0000", consent: true, notes: "", ownerId: null };

describe("referral phone normalization", () => {
  it("stores national digits and matches the international form", () => {
    expect(normalizeReferralPhone("(21) 99999-0000")).toEqual({ digits: "21999990000", candidates: ["21999990000", "5521999990000"] });
    expect(normalizeReferralPhone("+55 21 99999-0000").digits).toBe("21999990000");
    expect(normalizeReferralPhone("21 3333-4444").digits).toBe("2133334444");
  });
  it("rejects short, long or foreign-sized numbers", () => {
    for (const phone of ["99999-0000", "123456789012345", "991234567890"]) expect(() => normalizeReferralPhone(phone)).toThrow("DDD");
  });
});

describe("referral status flow", () => {
  it("follows the approved sequence", () => {
    expect(availableReferralStatuses("registered")).toEqual(["validated", "lost", "duplicate"]);
    expect(availableReferralStatuses("converted")).toEqual([]);
    expect(() => assertReferralTransition(base, { status: "converted", reason: "", leadId: null })).toThrow("não é permitida");
    expect(() => assertReferralTransition(base, { status: "registered", reason: "", leadId: null })).toThrow("já está");
  });
  it("requires reasons, consent and a linked lead where applicable", () => {
    expect(() => assertReferralTransition(base, { status: "lost", reason: "ok", leadId: null })).toThrow("motivo da perda");
    expect(() => assertReferralTransition(base, { status: "lost", reason: "Sem interesse", leadId: null })).not.toThrow();
    expect(() => assertReferralTransition({ ...base, status: "validated" }, { status: "contacting", reason: "", leadId: null })).toThrow("consentimento");
    expect(() => assertReferralTransition({ ...base, status: "validated", consent: true }, { status: "contacting", reason: "", leadId: null })).not.toThrow();
    expect(() => assertReferralTransition(base, { status: "duplicate", reason: "", leadId: null })).toThrow("negócio existente");
    expect(() => assertReferralTransition({ ...base, status: "lost" }, { status: "validated", reason: "", leadId: null })).toThrow("reabertura");
    expect(() => assertReferralTransition({ ...base, status: "contacting", consent: true }, { status: "opportunity", reason: "", leadId: null })).toThrow("Vincule");
  });
  it("counts as converted only with a converted lead or an active sale", () => {
    expect(isConvertedLead({ status: "negotiation" }, false)).toBe(false);
    expect(isConvertedLead({ status: "converted" }, false)).toBe(true);
    expect(isConvertedLead({ status: "documentation_pending" }, true)).toBe(true);
  });
});

describe("referral input", () => {
  it("accepts the minimal record and rejects unknown channels or fields", () => {
    expect(referralInputSchema.parse(input).channel).toBe("cliente");
    expect(referralInputSchema.safeParse({ ...input, channel: "anuncio" }).success).toBe(false);
    expect(referralInputSchema.safeParse({ ...input, tenantId: "x" }).success).toBe(false);
    expect(referralInputSchema.safeParse({ ...input, requestId: "abc" }).success).toBe(false);
  });
  it("falls back to safe filters", () => {
    expect(referralFiltersSchema.parse({ status: "hack", page: "-3" })).toMatchObject({ q: "", status: "all", page: 1 });
  });
});
