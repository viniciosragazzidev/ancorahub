import { describe, expect, it } from "vitest";

import { selectContiguousNextPresenceOccurrence } from "./duty-presence-preconfirm-domain";

const end = new Date("2026-11-16T16:00:00.000Z");

describe("selectContiguousNextPresenceOccurrence", () => {
  it("aceita apenas início exatamente igual ao fim do turno confirmado", () => {
    expect(selectContiguousNextPresenceOccurrence({
      currentEndsAt: end,
      candidates: [
        { assignmentId: "gap", dutyDate: "2026-11-16", startsAt: new Date(end.getTime() + 60_000), endsAt: new Date(end.getTime() + 3_600_000), status: null },
        { assignmentId: "next", dutyDate: "2026-11-16", startsAt: end, endsAt: new Date(end.getTime() + 3_600_000), status: "pending" },
      ],
    })?.assignmentId).toBe("next");
  });

  it("não oferece turno confirmado, ausente, expirado ou ambíguo", () => {
    const candidate = { assignmentId: "next", dutyDate: "2026-11-16", startsAt: end, endsAt: new Date(end.getTime() + 3_600_000) };
    for (const status of ["confirmed", "absent", "expired"]) {
      expect(selectContiguousNextPresenceOccurrence({ currentEndsAt: end, candidates: [{ ...candidate, status }] })).toBeNull();
    }
    expect(selectContiguousNextPresenceOccurrence({ currentEndsAt: end, candidates: [{ ...candidate, status: null }, { ...candidate, assignmentId: "other", status: null }] })).toBeNull();
  });
});
