import { describe, expect, it } from "vitest";

import { selectAssignmentsToRelease } from "./roster-release";

const now = new Date("2026-11-09T15:00:00.000Z"); // 12:00 in São Paulo

describe("selectAssignmentsToRelease", () => {
  it("closes weekly slots, the running shift and future shifts, and keeps finished ones", () => {
    const slots = [
      { id: "weekly", dutyDate: null, startsAt: "08:00", endsAt: "12:00" },
      { id: "running", dutyDate: "2026-11-09", startsAt: "10:00", endsAt: "14:00" },
      { id: "later-today", dutyDate: "2026-11-09", startsAt: "18:00", endsAt: "22:00" },
      { id: "tomorrow", dutyDate: "2026-11-10", startsAt: "08:00", endsAt: "12:00" },
      { id: "ended-today", dutyDate: "2026-11-09", startsAt: "07:00", endsAt: "11:00" },
      { id: "yesterday", dutyDate: "2026-11-08", startsAt: "08:00", endsAt: "18:00" },
    ];
    expect(selectAssignmentsToRelease(slots, now).map((slot) => slot.id)).toEqual(["weekly", "running", "later-today", "tomorrow"]);
  });

  it("closes an overnight shift from yesterday that is still running", () => {
    const early = new Date("2026-11-09T04:00:00.000Z"); // 01:00 in São Paulo
    expect(selectAssignmentsToRelease([{ id: "night", dutyDate: "2026-11-08", startsAt: "22:00", endsAt: "06:00" }], early)).toHaveLength(1);
  });

  it("uses the plantão timezone", () => {
    // 12:00 in São Paulo is 11:00 in Manaus: a Manaus shift ending at 11:30 is still running.
    expect(selectAssignmentsToRelease([{ id: "manaus", dutyDate: "2026-11-09", startsAt: "08:00", endsAt: "11:30", timezone: "America/Manaus" }], now)).toHaveLength(1);
    expect(selectAssignmentsToRelease([{ id: "sp", dutyDate: "2026-11-09", startsAt: "08:00", endsAt: "11:30" }], now)).toHaveLength(0);
  });
});
