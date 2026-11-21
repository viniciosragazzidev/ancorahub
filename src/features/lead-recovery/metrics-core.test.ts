import { describe, expect, it } from "vitest";

import { isRecovered, recoveryNumbers, recoverySteps, recoveryWeeks, weekStartOf, type RecoveryLeadRow } from "./metrics-core";
import { isRecoveryControl, parseRecoverySettings, recoveryBlockers, recoveryBucket } from "./settings-core";

const lead = (partial: Partial<RecoveryLeadRow>): RecoveryLeadRow => ({
  leadId: "l", createdAt: "2026-11-17T12:00:00Z", qualificationStatus: "pending", status: "new", hasBroker: false, replied: false,
  recoveryState: null, doNotContact: false, cadenceActive: false, enteredAt: null, repliedAfterEntry: false, ...partial,
});

describe("recuperado", () => {
  it("só conta quem entrou na recuperação, respondeu depois e esquentou", () => {
    expect(isRecovered(lead({ enteredAt: "2026-11-17T13:00:00Z", repliedAfterEntry: true, qualificationStatus: "hot" }))).toBe(true);
    expect(isRecovered(lead({ enteredAt: "2026-11-17T13:00:00Z", repliedAfterEntry: true, qualificationStatus: "warm" }))).toBe(true);
    expect(isRecovered(lead({ enteredAt: "2026-11-17T13:00:00Z", repliedAfterEntry: true, status: "quote_sent", qualificationStatus: "cold" }))).toBe(true);
    expect(isRecovered(lead({ enteredAt: "2026-11-17T13:00:00Z", repliedAfterEntry: false, qualificationStatus: "hot" }))).toBe(false);
    expect(isRecovered(lead({ enteredAt: null, repliedAfterEntry: true, qualificationStatus: "hot" }))).toBe(false);
    expect(isRecovered(lead({ enteredAt: "2026-11-17T13:00:00Z", repliedAfterEntry: true, qualificationStatus: "cold" }))).toBe(false);
  });
});

describe("recoveryNumbers", () => {
  it("separa as etapas sem contar duas vezes quem não pode ser contatado", () => {
    const numbers = recoveryNumbers([
      lead({ qualificationStatus: "cold", replied: true }),
      lead({ qualificationStatus: "cold", replied: false, cadenceActive: true }),
      lead({ qualificationStatus: "hot" }),
      lead({ qualificationStatus: "cold", recoveryState: "call_queue" }),
      lead({ qualificationStatus: "cold", doNotContact: true }),
      lead({ qualificationStatus: "qualifying" }),
    ]);
    expect(numbers).toMatchObject({ entered: 6, stoppedMidway: 1, neverReplied: 1, inFollowUp: 1, hot: 1, callQueue: 1, doNotContact: 1, qualifying: 1 });
  });
});

describe("recoverySteps", () => {
  it("agrupa por passo, na ordem da cadência, com o motivo mais comum de pulo", () => {
    const rows = recoverySteps([
      { leadId: "a", step: "t2", status: "skipped", reason: "template_not_approved", at: "2026-11-17T12:00:00Z", replied: false, costBrl: 0 },
      { leadId: "b", step: "t2", status: "skipped", reason: "template_not_approved", at: "2026-11-17T12:00:00Z", replied: false, costBrl: 0 },
      { leadId: "a", step: "t1", status: "sent", reason: null, at: "2026-11-17T12:00:00Z", replied: true, costBrl: 0.038 },
      { leadId: "c", step: "s1", status: "sent", reason: null, at: "2026-11-17T12:00:00Z", replied: true, costBrl: 0 },
    ], new Set(["a"]));
    expect(rows.map((row) => row.step)).toEqual(["t1", "t2", "s1"]);
    expect(rows[0]).toMatchObject({ sent: 1, replied: 1, recovered: 1, costBrl: 0.04 });
    expect(rows[1]).toMatchObject({ skipped: 2, topSkipReason: "template não aprovado" });
  });
});

describe("recoveryWeeks", () => {
  it("segunda-feira em São Paulo", () => {
    expect(weekStartOf("2026-11-21T17:00:00Z")).toBe("2026-11-16T03:00:00.000Z");
    expect(weekStartOf("2026-11-16T02:00:00Z")).toBe("2026-11-09T03:00:00.000Z");
  });

  it("separa o grupo de controle por semana", () => {
    const ids = Array.from({ length: 200 }, (_, index) => `lead-${index}`);
    const rows = ids.map((leadId) => lead({ leadId, enteredAt: "2026-11-18T12:00:00Z", repliedAfterEntry: true, qualificationStatus: "hot" }));
    const [week] = recoveryWeeks(rows, 10, 1, new Date("2026-11-21T17:00:00Z"));
    expect(week.entered + week.enteredControl).toBe(200);
    expect(week.enteredControl).toBe(ids.filter((id) => isRecoveryControl(id, 10)).length);
    expect(week.enteredControl).toBeGreaterThan(5);
    expect(week.enteredControl).toBeLessThan(40);
  });
});

describe("settings", () => {
  it("nasce tudo desligado, com 10% de controle", () => {
    const settings = parseRecoverySettings(null);
    expect(settings.enabled).toBe(false);
    expect(settings.callQueue).toBe(false);
    expect(settings.nurture).toBe(false);
    expect(settings.controlPct).toBe(10);
    expect(recoveryBlockers(settings)).toHaveLength(2);
  });

  it("nunca deixa passo de template sair por WAHA e limita o controle a 50%", () => {
    const settings = parseRecoverySettings(JSON.stringify({ controlPct: 90, steps: { s4: { enabled: true, channel: "waha" }, s2: { enabled: false, channel: "waha" } } }));
    expect(settings.steps.s4.channel).toBe("meta");
    expect(settings.steps.s2).toEqual({ enabled: false, channel: "waha" });
    expect(settings.controlPct).toBe(50);
  });

  it("bucket estável", () => {
    expect(recoveryBucket("lead-1")).toBe(recoveryBucket("lead-1"));
    expect(recoveryBucket("lead-1")).toBeGreaterThanOrEqual(0);
    expect(recoveryBucket("lead-1")).toBeLessThan(100);
  });
});
