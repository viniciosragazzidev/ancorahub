import { describe, expect, it } from "vitest";

import { canManuallyAssignLeadToBroker, selectMatchingDutyScheduleIds, selectQueueLinkedDutySchedules } from "./duty-roster-matching";

const allOrigins = { id: "all", webhookCredentialId: null };
const metaAds = { id: "meta", webhookCredentialId: "credential-meta" };
const googleAds = { id: "google", webhookCredentialId: "credential-google" };

describe("selectMatchingDutyScheduleIds", () => {
  it("aplica o plantão de todas as origens mesmo quando o lead tem credencial", () => {
    expect(selectMatchingDutyScheduleIds([allOrigins, metaAds], "credential-google")).toEqual(["all"]);
  });

  it("combina o plantão geral com o plantão específico da origem", () => {
    expect(selectMatchingDutyScheduleIds([allOrigins, metaAds, googleAds], "credential-meta")).toEqual([
      "all",
      "meta",
    ]);
  });

  it("não usa plantão específico quando a origem do lead é desconhecida", () => {
    expect(selectMatchingDutyScheduleIds([allOrigins, metaAds], null)).toEqual(["all"]);
  });
});

describe("selectQueueLinkedDutySchedules", () => {
  it("returns every active schedule linked to the lead queue, regardless of roster unit", () => {
    const schedules = [
      { id: "legacy-queue-link", queueId: "queue-a", webhookCredentialId: null, branchId: "branch-2" },
      { id: "explicit-link", queueId: null, webhookCredentialId: null, branchId: "branch-3" },
      { id: "other-queue", queueId: "queue-b", webhookCredentialId: null, branchId: "branch-1" },
    ];

    expect(selectQueueLinkedDutySchedules(schedules, "queue-a", ["explicit-link"])).toEqual(schedules.slice(0, 2));
  });

  it("does not broaden to unit schedules when the queue has no explicit active duty link", () => {
    const schedules = [
      { id: "unit-schedule", queueId: null, webhookCredentialId: null, branchId: "branch-1" },
    ];

    expect(selectQueueLinkedDutySchedules(schedules, "queue-a", [])).toEqual([]);
  });
});

describe("canManuallyAssignLeadToBroker", () => {
  it("allows a rostered broker from another unit for an active queue duty", () => {
    expect(canManuallyAssignLeadToBroker({
      hasActiveQueueDuty: true,
      brokerId: "broker-from-another-unit",
      brokerBranchId: "branch-b",
      leadBranchId: "branch-a",
      activeDutyBrokerIds: ["broker-from-another-unit"],
    })).toBe(true);
  });

  it("rejects a broker outside the active duty roster even if their unit matches", () => {
    expect(canManuallyAssignLeadToBroker({
      hasActiveQueueDuty: true,
      brokerId: "not-on-duty",
      brokerBranchId: "branch-a",
      leadBranchId: "branch-a",
      activeDutyBrokerIds: ["on-duty"],
    })).toBe(false);
  });

  it("keeps the existing same-unit rule when no queue duty is active", () => {
    const base = {
      hasActiveQueueDuty: false,
      brokerId: "broker",
      leadBranchId: "branch-a",
      activeDutyBrokerIds: [],
    };
    expect(canManuallyAssignLeadToBroker({ ...base, brokerBranchId: "branch-a" })).toBe(true);
    expect(canManuallyAssignLeadToBroker({ ...base, brokerBranchId: "branch-b" })).toBe(false);
  });
});
