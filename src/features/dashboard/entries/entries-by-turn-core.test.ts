import { describe, expect, it } from "vitest";

import { bucketEntriesByTurn, entriesCsv, share } from "./entries-by-turn-core";

// Dia de operação de teste: começa às 22h UTC (19h de São Paulo).
const dayOf = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - (date.getUTCHours() < 22 ? 1 : 0), 22));
const d1 = new Date("2026-11-19T22:00:00Z");
const d2 = new Date("2026-11-18T22:00:00Z");

describe("bucketEntriesByTurn", () => {
  it("soma por dia e por turno, por canal, do dia mais recente ao mais antigo, com dias zerados", () => {
    const data = bucketEntriesByTurn(
      [
        { hour: new Date("2026-11-20T10:00:00Z"), shift: 1, channel: "whatsapp", total: 3 },
        { hour: new Date("2026-11-20T17:00:00Z"), shift: 2, channel: "form", total: 5 },
        { hour: new Date("2026-11-19T12:00:00Z"), shift: 1, channel: "other", total: 1 },
        { hour: new Date("2026-11-01T12:00:00Z"), shift: 1, channel: "form", total: 9 },
      ],
      [d1, d2, new Date("2026-11-17T22:00:00Z")],
      dayOf,
    );
    expect(data.days.map((day) => [day.start.toISOString(), day.shifts[1].whatsapp, day.shifts[2].form, day.total.total])).toEqual([
      [d1.toISOString(), 3, 5, 8],
      [d2.toISOString(), 0, 0, 1],
      ["2026-11-17T22:00:00.000Z", 0, 0, 0],
    ]);
    expect(data.shifts[1]).toEqual({ whatsapp: 3, form: 0, other: 1, total: 4 });
    expect(data.shifts[2]).toEqual({ whatsapp: 0, form: 5, other: 0, total: 5 });
    expect(data.totals).toEqual({ whatsapp: 3, form: 5, other: 1, total: 9 });
  });

  it("CSV com os dois turnos por canal e a linha de total; share sem divisão por zero", () => {
    const csv = entriesCsv(bucketEntriesByTurn([{ hour: new Date("2026-11-20T10:00:00Z"), shift: 1, channel: "whatsapp", total: 2 }], [d1], dayOf));
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Dia;Turno 1 WhatsApp;Turno 1 Formulário;Turno 1 Outros;Turno 2 WhatsApp;Turno 2 Formulário;Turno 2 Outros;Total");
    expect(lines.at(-1)).toBe("Total;2;0;0;0;0;0;2");
    expect(share(1, 0)).toBe(0);
    expect(share(1, 3)).toBe(33);
  });
});
