import { describe, expect, it } from "vitest";
import { countDutyLeadsByBroker, countReceivedInDuty } from "./duty-attribution";
import { matchesDutyHistoryAttribution } from "./duty-history-attribution";

describe("legacy nullable duty attribution", () => {
  const since = new Date("2026-10-05T22:00:00.000Z");

  it("keeps null-attributed records in receivedInDuty but excludes another explicit schedule", () => {
    const receipts = [
      { brokerId: "broker-a", leadId: "legacy", dutyScheduleId: null, receivedAt: new Date("2026-10-06T09:00:00.000Z") },
      { brokerId: "broker-a", leadId: "same-duty", dutyScheduleId: "schedule-a", receivedAt: new Date("2026-10-06T10:00:00.000Z") },
      { brokerId: "broker-a", leadId: "other-duty", dutyScheduleId: "schedule-b", receivedAt: new Date("2026-10-06T11:00:00.000Z") },
      { brokerId: "broker-a", leadId: "yesterday", dutyScheduleId: null, receivedAt: new Date("2026-10-05T20:00:00.000Z") },
    ];

    expect(countReceivedInDuty({ brokerId: "broker-a", scheduleId: "schedule-a", since, receipts })).toBe(2);
    expect(countReceivedInDuty({ brokerId: "broker-a", scheduleId: undefined, since, receipts })).toBe(1);
  });

  it("counts null-attributed leads against the occurrence cap, not a different explicit schedule", () => {
    const counts = countDutyLeadsByBroker([
      { brokerId: "broker-a", leadId: "legacy", dutyScheduleId: null },
      { brokerId: "broker-a", leadId: "explicit-same", dutyScheduleId: "schedule-a" },
      { brokerId: "broker-a", leadId: "explicit-other", dutyScheduleId: "schedule-b" },
      { brokerId: null, leadId: "unassigned", dutyScheduleId: null },
    ], "schedule-a");

    expect(counts.get("broker-a")).toBe(2);
    expect(counts.has("broker-b")).toBe(false);
  });

  it("keeps old occurrence history by queue or schedule date unless an explicit other schedule exists", () => {
    const base = { scheduleId: "schedule-a", dutyDate: "2026-10-06", queueIds: ["queue-a"] };

    expect(matchesDutyHistoryAttribution({ ...base, dutyScheduleId: null, queueId: "queue-a", metadata: null })).toBe(true);
    expect(matchesDutyHistoryAttribution({ ...base, dutyScheduleId: null, queueId: null, metadata: { scheduleId: "schedule-a", dutyDate: "2026-10-06" } })).toBe(true);
    expect(matchesDutyHistoryAttribution({ ...base, dutyScheduleId: "schedule-b", queueId: "queue-a", metadata: null })).toBe(false);
  });
});
