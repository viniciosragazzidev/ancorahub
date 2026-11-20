import { describe, expect, it } from "vitest";

import { daysInQueue } from "./implantations-workspace";

describe("na fila há", () => {
  it("conta dias inteiros desde a entrada na etapa", () => {
    const now = new Date("2026-11-20T15:00:00Z");
    expect(daysInQueue("2026-11-20T09:00:00Z", now)).toBe(0);
    expect(daysInQueue("2026-11-12T15:00:00Z", now)).toBe(8);
    expect(daysInQueue(null, now)).toBeNull();
    expect(daysInQueue("data ruim", now)).toBeNull();
  });
});
