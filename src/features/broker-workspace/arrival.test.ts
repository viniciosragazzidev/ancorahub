import { describe, expect, it } from "vitest";

import { arrivalDayLabel, formatBrokerArrival, groupByArrivalDay, isBrokerArrivalToday } from "./arrival";

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

describe("broker list by arrival day", () => {
  const now = new Date("2026-10-21T10:00:00-03:00");

  it("labels the day separators as Hoje, Ontem and dd/mm (weekday) in São Paulo time", () => {
    expect(arrivalDayLabel("2026-10-21T00:30:00-03:00", now)).toBe("Hoje");
    // 01:30 UTC on the 21st is still the 20th in São Paulo.
    expect(arrivalDayLabel("2026-10-21T01:30:00Z", now)).toBe("Ontem");
    expect(arrivalDayLabel("2026-10-18T15:00:00-03:00", now)).toBe("18/10 (dom)");
    expect(arrivalDayLabel("2026-10-17T15:00:00-03:00", now)).toBe("17/10 (sáb)");
    expect(arrivalDayLabel(null, now)).toBe("Sem data");
  });

  it("orders by arrival, newest first, and groups by day without any priority", () => {
    const items = [
      { name: "Velho urgente", at: "2026-10-17T09:00:00-03:00" },
      { name: "Sem horário", at: null },
      { name: "Ontem tarde", at: "2026-10-20T18:00:00-03:00" },
      { name: "Hoje cedo", at: "2026-10-21T08:00:00-03:00" },
      { name: "Hoje agora", at: "2026-10-21T09:59:00-03:00" },
      { name: "Ontem cedo", at: "2026-10-20T07:00:00-03:00" },
    ];
    const groups = groupByArrivalDay(items, (item) => item.at, now, (item) => item.name);
    expect(groups.map((group) => group.label)).toEqual(["Hoje", "Ontem", "17/10 (sáb)", "Sem data"]);
    expect(groups.map((group) => group.items.map((item) => item.name))).toEqual([
      ["Hoje agora", "Hoje cedo"],
      ["Ontem tarde", "Ontem cedo"],
      ["Velho urgente"],
      ["Sem horário"],
    ]);
  });

  it("returns no groups for an empty list", () => {
    expect(groupByArrivalDay([], () => null, now)).toEqual([]);
  });
});
