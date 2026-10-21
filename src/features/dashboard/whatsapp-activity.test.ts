import { describe, expect, it } from "vitest";

import { summarizeWhatsAppActivity } from "./whatsapp-activity";

describe("summarizeWhatsAppActivity", () => {
  it("sums distinct-lead counts already aggregated by SQL and sorts connected brokers by count", () => {
    expect(summarizeWhatsAppActivity([
      { id: "b1", name: "Ana", connected: true, leadCount: 2 },
      { id: "b2", name: "Bruno", connected: false, leadCount: 99 },
      { id: "b3", name: "Carla", connected: true, leadCount: "5" },
      { id: "b4", name: "Dora", connected: true, leadCount: 0 },
    ])).toEqual({
      connectedBrokerCount: 3,
      totalLeads: 7,
      brokers: [
        { id: "b3", name: "Carla", leadCount: 5 },
        { id: "b1", name: "Ana", leadCount: 2 },
        { id: "b4", name: "Dora", leadCount: 0 },
      ],
    });
  });

  it("returns an empty summary when no personal connection is connected", () => {
    expect(summarizeWhatsAppActivity([{ id: "b1", name: "Ana", connected: false, leadCount: 4 }])).toEqual({
      connectedBrokerCount: 0,
      totalLeads: 0,
      brokers: [],
    });
  });
});
