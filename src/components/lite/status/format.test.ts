import { describe, expect, it } from "vitest";

import { formatAbsoluteTime, formatAgo, formatCountdown } from "./format";

describe("formatCountdown", () => {
  it("abaixo de 1 h em mm:ss, abaixo de 24 h em hh:mm:ss, acima em dias e horas", () => {
    expect(formatCountdown(0)).toBe("00:00");
    expect(formatCountdown(-5_000)).toBe("00:00");
    expect(formatCountdown(161_000)).toBe("02:41");
    expect(formatCountdown(59 * 60_000 + 59_000)).toBe("59:59");
    expect(formatCountdown(3_600_000)).toBe("01:00:00");
    expect(formatCountdown((14 * 3600 + 22 * 60 + 10) * 1000)).toBe("14:22:10");
    expect(formatCountdown((2 * 86_400 + 4 * 3600 + 12 * 60) * 1000)).toBe("2 d 04 h");
  });

  it("arredonda para cima: nunca mostra 00:00 antes da hora", () => {
    expect(formatCountdown(400)).toBe("00:01");
  });
});

describe("formatAgo", () => {
  it("segundos, minutos, horas e dias", () => {
    expect(formatAgo(40_000)).toBe("há 40 s");
    expect(formatAgo(12 * 60_000)).toBe("há 12 min");
    expect(formatAgo(3 * 3_600_000)).toBe("há 3 h");
    expect(formatAgo(2 * 86_400_000)).toBe("há 2 d");
  });
});

describe("formatAbsoluteTime (São Paulo)", () => {
  const reference = "2026-10-27T13:00:00.000Z"; // 10:00 em SP
  it("mesmo dia", () => {
    expect(formatAbsoluteTime("2026-10-27T18:42:00.000Z", reference)).toBe("às 15:42");
  });
  it("dia seguinte em SP, mesmo quando em UTC ainda é o mesmo dia", () => {
    expect(formatAbsoluteTime("2026-10-28T12:00:00.000Z", reference)).toBe("amanhã às 09:00");
    expect(formatAbsoluteTime("2026-10-28T02:30:00.000Z", reference)).toBe("às 23:30");
  });
  it("mais longe", () => {
    expect(formatAbsoluteTime("2026-10-30T12:00:00.000Z", reference)).toBe("30/10 às 09:00");
  });
});
