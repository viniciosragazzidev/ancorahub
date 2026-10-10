import { describe, expect, it } from "vitest";

import { ENGAGEMENT_RULES, resolveRules } from "./catalog";
import { applyDailyCaps, periodDay, scoreFastAccept, scoreFirstContact, scorePresence, scoreReturnOnTime, scoreServiceNote } from "./scoring";

const at = (iso: string) => new Date(iso);
const rules = ENGAGEMENT_RULES;

describe("first contact (evidence: first message actually sent)", () => {
  const base = { leadId: "l1", brokerId: "b1", assignedAt: at("2026-10-10T13:00:00Z"), slaMinutes: 15 };

  it("scores by tier and keeps one key per lead, broker and assignment", () => {
    expect(scoreFirstContact({ ...base, firstOutboundAt: at("2026-10-10T13:04:00Z") }, rules["contact.first"])).toMatchObject({ points: 15, metadata: { tier: "5min" }, idempotencyKey: `contact.first:l1:b1:${base.assignedAt.getTime()}` });
    expect(scoreFirstContact({ ...base, firstOutboundAt: at("2026-10-10T13:12:00Z") }, rules["contact.first"])).toMatchObject({ points: 10 });
  });

  it("only has the SLA tier when the tenant SLA is longer than 15 min", () => {
    const late = { ...base, firstOutboundAt: at("2026-10-10T13:40:00Z") };
    expect(scoreFirstContact(late, rules["contact.first"])).toBeNull();
    expect(scoreFirstContact({ ...late, slaMinutes: 60 }, rules["contact.first"])).toMatchObject({ points: 5, metadata: { tier: "sla" } });
  });

  it("ignores a message before the assignment and a disabled rule", () => {
    expect(scoreFirstContact({ ...base, firstOutboundAt: at("2026-10-10T12:59:00Z") }, rules["contact.first"])).toBeNull();
    expect(scoreFirstContact({ ...base, firstOutboundAt: at("2026-10-10T13:01:00Z") }, { ...rules["contact.first"], enabled: false })).toBeNull();
  });

  it("scales tiers when the tenant changes the top value", () => {
    expect(scoreFirstContact({ ...base, firstOutboundAt: at("2026-10-10T13:10:00Z") }, { ...rules["contact.first"], points: 30 })).toMatchObject({ points: 20 });
  });
});

describe("other rules", () => {
  it("fast accept only within 1 minute", () => {
    const offer = { offerId: "o1", leadId: "l1", brokerId: "b1", offeredAt: at("2026-10-10T13:00:00Z") };
    expect(scoreFastAccept({ ...offer, acceptedAt: at("2026-10-10T13:00:40Z") }, rules["offer.fast_accept"])).toMatchObject({ points: 3 });
    expect(scoreFastAccept({ ...offer, acceptedAt: at("2026-10-10T13:02:00Z") }, rules["offer.fast_accept"])).toBeNull();
  });

  it("a self-scheduled return due in 5 minutes does not score; one scheduled 2h+ ahead does", () => {
    const task = { taskId: "t1", leadId: "l1", assignedTo: "b1", createdBy: "b1", createdAt: at("2026-10-10T13:00:00Z") };
    expect(scoreReturnOnTime({ ...task, dueAt: at("2026-10-10T13:05:00Z"), completedAt: at("2026-10-10T13:04:00Z") }, rules["return.on_time"])).toBeNull();
    expect(scoreReturnOnTime({ ...task, dueAt: at("2026-10-10T16:00:00Z"), completedAt: at("2026-10-10T15:50:00Z") }, rules["return.on_time"])).toMatchObject({ points: 5 });
    // Set by someone else: any lead time; late never scores.
    expect(scoreReturnOnTime({ ...task, createdBy: "manager", dueAt: at("2026-10-10T13:05:00Z"), completedAt: at("2026-10-10T13:04:00Z") }, rules["return.on_time"])).toMatchObject({ points: 5 });
    expect(scoreReturnOnTime({ ...task, createdBy: "manager", dueAt: at("2026-10-10T13:05:00Z"), completedAt: at("2026-10-10T13:06:00Z") }, rules["return.on_time"])).toBeNull();
  });

  it("a short note does not score and the same text the same day shares one key", () => {
    const note = { leadId: "l1", brokerId: "b1", createdAt: at("2026-10-10T15:00:00Z") };
    expect(scoreServiceNote({ ...note, noteId: "n0", content: "liguei" }, rules["note.service"])).toBeNull();
    const text = "Cliente quer plano familiar para 4 vidas, volta amanhã com documentos.";
    const first = scoreServiceNote({ ...note, noteId: "n1", content: text }, rules["note.service"]);
    const copy = scoreServiceNote({ ...note, noteId: "n2", leadId: "l2", content: `  ${text.toUpperCase()} ` }, rules["note.service"]);
    expect(first?.idempotencyKey).toBe(copy?.idempotencyKey);
  });

  it("presence is off by default (legal opinion first) and never for a manager release", () => {
    const presence = { confirmationId: "p1", brokerId: "b1", confirmedAt: at("2026-10-10T12:00:00Z"), confirmedBy: null };
    expect(scorePresence(presence, rules["duty.presence"])).toBeNull();
    expect(scorePresence({ ...presence, confirmedBy: "manager" }, { ...rules["duty.presence"], enabled: true })).toBeNull();
    expect(scorePresence(presence, { ...rules["duty.presence"], enabled: true })).toMatchObject({ points: 10 });
  });
});

describe("daily caps and settings", () => {
  it("caps per broker, rule and São Paulo day, counting what is already in the ledger", () => {
    const capped = { ...rules, "note.service": { ...rules["note.service"], dailyCap: 2 } };
    const make = (id: string, iso: string) => scoreServiceNote({ noteId: id, leadId: id, brokerId: "b1", content: `Atendimento detalhado número ${id} com o cliente sobre o plano.`, createdAt: at(iso) }, capped["note.service"])!;
    const candidates = [make("a", "2026-10-10T12:00:00Z"), make("b", "2026-10-10T13:00:00Z"), make("c", "2026-10-10T14:00:00Z")];
    expect(applyDailyCaps(candidates, capped, new Map())).toHaveLength(2);
    expect(applyDailyCaps(candidates, capped, new Map([["b1|note.service|2026-10-10", 2]]))).toHaveLength(0);
  });

  it("uses the São Paulo day (01:30 UTC is still the previous day)", () => {
    expect(periodDay(at("2026-10-11T01:30:00Z"))).toBe("2026-10-10");
  });

  it("applies valid tenant adjustments and ignores invalid ones", () => {
    expect(resolveRules({ "note.service": { points: 4, dailyCap: 5 } })["note.service"]).toMatchObject({ points: 4, dailyCap: 5, enabled: true });
    expect(resolveRules({ "note.service": { points: -3 } })["note.service"].points).toBe(3);
  });
});
