import { describe, expect, it } from "vitest";

import { shiftState } from "./duty-month-calendar";

describe("estado do plantão no quadro", () => {
  const today = "2026-11-20";
  it("hoje: agora entre o início e o fim, por começar antes, encerrado depois", () => {
    expect(shiftState(today, today, "10:30", "09:00", "12:00", false)).toBe("running");
    expect(shiftState(today, today, "08:59", "09:00", "12:00", false)).toBe("upcoming");
    expect(shiftState(today, today, "12:00", "09:00", "12:00", false)).toBe("done");
  });
  it("dia futuro é por começar; dia passado ou marcado como feito é encerrado", () => {
    expect(shiftState("2026-11-23", today, "10:00", "09:00", "12:00", false)).toBe("upcoming");
    expect(shiftState("2026-11-19", today, "10:00", "09:00", "12:00", false)).toBe("done");
    expect(shiftState(today, today, "10:00", "09:00", "12:00", true)).toBe("done");
  });
  it("plantão que vira a noite (fim menor que início) segue ativo depois do início", () => {
    expect(shiftState(today, today, "22:00", "19:00", "07:00", false)).toBe("running");
  });
});
