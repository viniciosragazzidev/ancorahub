import { describe, expect, it } from "vitest";

import { formatBrokerArrival, isBrokerArrivalToday } from "./arrival";

describe("broker lead arrival", () => {
  const now = new Date("2026-10-17T16:00:00-03:00");

  it("formats distribution times in São Paulo time", () => {
    expect(formatBrokerArrival("2026-10-17T13:32:00-03:00", now)).toBe("hoje 13:32");
    expect(formatBrokerArrival("2026-10-16T14:32:00-03:00", now)).toBe("ontem 14:32");
    expect(formatBrokerArrival("2026-10-13T14:32:00-03:00", now)).toBe("há 4 dias");
    expect(formatBrokerArrival("2026-10-03T14:32:00-03:00", now)).toBe("em 03/10 · há 14 dias");
  });

  it("marks only distributions from the local day as today's leads", () => {
    expect(isBrokerArrivalToday("2026-10-17T23:50:00Z", now)).toBe(true);
    expect(isBrokerArrivalToday("2026-10-16T23:50:00-03:00", now)).toBe(false);
    expect(isBrokerArrivalToday(null, now)).toBe(false);
  });
});
