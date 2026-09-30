import { describe, expect, it } from "vitest";

import { buildQueueTabs, readQueueTab } from "./queue-tabs";

describe("queue tabs of /leads", () => {
  it("shows all, every active queue (busiest first), inactive ones with leads, and leads without queue", () => {
    const tabs = buildQueueTabs({
      activeQueues: [{ id: "a", name: "FILA TATIANA" }, { id: "b", name: "Plantão PME" }, { id: "c", name: "Fila vazia" }],
      counts: [
        { queueId: "a", queueName: "FILA TATIANA", total: 12 },
        { queueId: "b", queueName: "Plantão PME", total: 30 },
        { queueId: "old", queueName: "Plantão 18", total: 2 },
        { queueId: null, queueName: null, total: 5 },
      ],
    });
    expect(tabs).toEqual([
      { value: "", label: "Todas", count: 49 },
      { value: "b", label: "Plantão PME", count: 30 },
      { value: "a", label: "FILA TATIANA", count: 12 },
      { value: "old", label: "Plantão 18", count: 2 },
      { value: "c", label: "Fila vazia", count: 0 },
      { value: "sem-fila", label: "Sem fila", count: 5 },
    ]);
  });

  it("reads the ?fila= value safely", () => {
    expect(readQueueTab("sem-fila")).toEqual({ kind: "none" });
    expect(readQueueTab("83b0dd02-0f68-4772-8aee-93751d0de330")).toEqual({ kind: "queue", queueId: "83b0dd02-0f68-4772-8aee-93751d0de330" });
    expect(readQueueTab("")).toBeNull();
    expect(readQueueTab("x' or 1=1")).toBeNull();
  });
});
