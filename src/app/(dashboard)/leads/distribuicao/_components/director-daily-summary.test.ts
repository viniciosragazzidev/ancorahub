import { describe, expect, it } from "vitest";

import type { BrokerDailySummaryItem } from "@/features/lead-distribution/broker-summary-service";

import { availabilityGroup, sortBrokersForFollowUp } from "./director-daily-summary";

const item = (brokerId: string, unstartedLeads: number, leadsReceived: number) => ({ brokerId, unstartedLeads, leadsReceived }) as BrokerDailySummaryItem;

describe("resumo da distribuição", () => {
  it("agrupa a disponibilidade em disponível, pausa e offline", () => {
    expect(availabilityGroup("available")).toBe("available");
    expect(availabilityGroup("busy")).toBe("available");
    expect(availabilityGroup("break")).toBe("paused");
    expect(availabilityGroup("paused")).toBe("paused");
    expect(availabilityGroup("offline")).toBe("offline");
  });

  it("põe primeiro quem tem lead sem contato, depois quem recebeu mais", () => {
    const sorted = sortBrokersForFollowUp([item("a", 0, 9), item("b", 2, 1), item("c", 0, 12), item("d", 5, 0)]);
    expect(sorted.map((broker) => broker.brokerId)).toEqual(["d", "b", "c", "a"]);
  });
});
