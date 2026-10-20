import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  buildMetaConversionEvent,
  isMetaConversionAuthError,
  isMetaConversionEventExpired,
  isMetaConversionRateLimit,
  isMetaLeadgenId,
  metaConversionEventId,
  metaConversionRetryDelayMs,
  normalizeMetaEmail,
  normalizeMetaPhone,
  resolveMetaConversionEventTime,
  serializeMetaConversionPayload,
  stagesForLeadState,
  stagesForQualificationStatus,
} from "./meta-conversion-events";

const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const now = new Date("2026-10-20T15:00:00.000Z");
const days = (value: number) => value * 24 * 60 * 60 * 1000;

describe("stage mapping", () => {
  it("maps warm to Qualificado and hot to Qualificado + Quente", () => {
    expect(stagesForQualificationStatus("warm")).toEqual(["qualified"]);
    expect(stagesForQualificationStatus("hot")).toEqual(["qualified", "hot"]);
    expect(stagesForQualificationStatus("cold")).toEqual([]);
    expect(stagesForQualificationStatus("qualifying")).toEqual([]);
    expect(stagesForQualificationStatus(null)).toEqual([]);
  });

  it("derives every stage a lead already reached", () => {
    expect(stagesForLeadState({ qualificationStatus: "pending", status: "new", hasSale: false })).toEqual(["lead_received"]);
    expect(stagesForLeadState({ qualificationStatus: "hot", status: "distributed", hasSale: false })).toEqual(["lead_received", "qualified", "hot"]);
    expect(stagesForLeadState({ qualificationStatus: "cold", status: "converted", hasSale: false })).toEqual(["lead_received", "sale"]);
    expect(stagesForLeadState({ qualificationStatus: "warm", status: "new", hasSale: true })).toEqual(["lead_received", "qualified", "sale"]);
  });

  it("uses a stable event id per lead and stage", () => {
    expect(metaConversionEventId("lead-1", "hot")).toBe("crm:lead-1:hot");
    expect(metaConversionEventId("lead-1", "hot")).toBe(metaConversionEventId("lead-1", "hot"));
  });
});

describe("normalization", () => {
  it("accepts only numeric leadgen ids", () => {
    expect(isMetaLeadgenId("1234567890123456")).toBe(true);
    expect(isMetaLeadgenId("abc123")).toBe(false);
    expect(isMetaLeadgenId("")).toBe(false);
    expect(isMetaLeadgenId(null)).toBe(false);
  });

  it("normalizes phones to digits with the Brazilian country code", () => {
    expect(normalizeMetaPhone("(21) 99876-5432")).toBe("5521998765432");
    expect(normalizeMetaPhone("+55 21 99876-5432")).toBe("5521998765432");
    expect(normalizeMetaPhone("021 3333-4444")).toBe("552133334444");
    expect(normalizeMetaPhone("123")).toBeNull();
    expect(normalizeMetaPhone(null)).toBeNull();
  });

  it("lowercases and trims emails and drops invalid ones", () => {
    expect(normalizeMetaEmail("  Joao.Silva@Exemplo.COM ")).toBe("joao.silva@exemplo.com");
    expect(normalizeMetaEmail("sem-arroba")).toBeNull();
    expect(normalizeMetaEmail("")).toBeNull();
  });
});

describe("event time", () => {
  const leadCreatedAt = new Date("2026-10-18T10:00:00.000Z");

  it("keeps a valid time", () => {
    const at = new Date("2026-10-19T10:00:00.000Z");
    expect(resolveMetaConversionEventTime({ at, leadCreatedAt, now })).toEqual(at);
  });

  it("is always after the lead creation", () => {
    const at = new Date("2026-10-17T10:00:00.000Z");
    expect(resolveMetaConversionEventTime({ at, leadCreatedAt, now }).getTime()).toBe(leadCreatedAt.getTime() + 1000);
  });

  it("is never in the future", () => {
    const at = new Date(now.getTime() + 60_000);
    expect(resolveMetaConversionEventTime({ at, leadCreatedAt, now })).toEqual(now);
  });

  it("expires after 7 days", () => {
    expect(isMetaConversionEventExpired(new Date(now.getTime() - days(6)), now)).toBe(false);
    expect(isMetaConversionEventExpired(new Date(now.getTime() - days(7) + 1000), now)).toBe(false);
    expect(isMetaConversionEventExpired(new Date(now.getTime() - days(7) - 1000), now)).toBe(true);
  });
});

describe("buildMetaConversionEvent", () => {
  it("builds the CRM event with hashed contact data", () => {
    const event = buildMetaConversionEvent({
      stage: "qualified",
      eventId: "crm:lead-1:qualified",
      metaLeadId: " 1234567890123456 ",
      eventTime: new Date("2026-10-19T10:00:00.500Z"),
      phone: "(21) 99876-5432",
      email: "Joao@Exemplo.com",
    });
    expect(event).toEqual({
      event_name: "Qualificado",
      event_time: Math.floor(new Date("2026-10-19T10:00:00.000Z").getTime() / 1000),
      event_id: "crm:lead-1:qualified",
      action_source: "system_generated",
      custom_data: { event_source: "crm", lead_event_source: "CorreTop" },
      user_data: {
        lead_id: "1234567890123456",
        ph: [sha("5521998765432")],
        em: [sha("joao@exemplo.com")],
      },
    });
  });

  it("omits hashes when contact data is missing", () => {
    const event = buildMetaConversionEvent({ stage: "lead_received", eventId: "e", metaLeadId: "1234567890123456", eventTime: now });
    expect(event.event_name).toBe("Lead recebido");
    expect(event.user_data).toEqual({ lead_id: "1234567890123456" });
  });

  it("writes lead_id as an exact int64 number and adds the test code", () => {
    const event = buildMetaConversionEvent({ stage: "sale", eventId: "e", metaLeadId: "12345678901234567", eventTime: now });
    const body = serializeMetaConversionPayload([event], " TEST123 ");
    expect(body).toContain("\"lead_id\":12345678901234567");
    expect(body).toContain("\"test_event_code\":\"TEST123\"");
    expect(serializeMetaConversionPayload([event], "")).not.toContain("test_event_code");
  });
});

describe("Meta errors and retry", () => {
  it("detects rate limits and auth errors", () => {
    expect(isMetaConversionRateLimit(17)).toBe(true);
    expect(isMetaConversionRateLimit(4)).toBe(true);
    expect(isMetaConversionRateLimit(80004)).toBe(true);
    expect(isMetaConversionRateLimit(undefined, 429)).toBe(true);
    expect(isMetaConversionRateLimit(100, 400)).toBe(false);
    expect(isMetaConversionAuthError(190)).toBe(true);
    expect(isMetaConversionAuthError(100)).toBe(false);
  });

  it("backs off exponentially up to 6 hours", () => {
    expect(metaConversionRetryDelayMs(1)).toBe(2 * 60_000);
    expect(metaConversionRetryDelayMs(3)).toBe(8 * 60_000);
    expect(metaConversionRetryDelayMs(20)).toBe(360 * 60_000);
  });
});
