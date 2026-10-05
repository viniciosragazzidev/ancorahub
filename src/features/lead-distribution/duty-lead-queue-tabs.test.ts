import { describe, expect, it } from "vitest";
import { getDutyLeadQueueTabs, resolveDutyLeadQueueId, selectDutyLeadsForQueue } from "./duty-lead-queue-tabs";

const queues = [
  { id: "queue-a", name: "Fila A" },
  { id: "queue-b", name: "Fila B" },
];

describe("plantão lead queue tabs", () => {
  it("counts available leads separately for each queue", () => {
    const tabs = getDutyLeadQueueTabs(queues, [
      { queueId: "queue-a" }, { queueId: "queue-a" }, { queueId: "queue-b" },
    ]);

    expect(tabs.map(({ id, count }) => [id, count])).toEqual([["queue-a", 2], ["queue-b", 1]]);
  });

  it("defaults to a valid requested queue, then the first queue", () => {
    expect(resolveDutyLeadQueueId(queues, "queue-b")).toBe("queue-b");
    expect(resolveDutyLeadQueueId(queues, "missing")).toBe("queue-a");
    expect(resolveDutyLeadQueueId([queues[0],], "queue-a")).toBeNull();
  });

  it("separates waiting leads by queue and keeps distributed leads combined", () => {
    const leads = [
      { id: "lead-a", queueId: "queue-a" },
      { id: "lead-b", queueId: "queue-b" },
    ];

    expect(selectDutyLeadsForQueue(leads, "queue-a", false).map((lead) => lead.id)).toEqual(["lead-a"]);
    expect(selectDutyLeadsForQueue(leads, "queue-b", false).map((lead) => lead.id)).toEqual(["lead-b"]);
    expect(selectDutyLeadsForQueue(leads, "queue-a", true).map((lead) => lead.id)).toEqual(["lead-a", "lead-b"]);
  });
});
