import { describe, expect, it } from "vitest";

import { bucketEntriesByTurn, entriesCsv, share } from "./entries-by-turn-core";

const turnOf = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - (date.getUTCHours() < 22 ? 1 : 0), 22));
const t1 = new Date("2026-11-19T22:00:00Z");
const t2 = new Date("2026-11-18T22:00:00Z");

describe("bucketEntriesByTurn", () => {
  it("soma as horas no turno certo, por canal, do mais recente ao mais antigo, com turnos zerados", () => {
    const data = bucketEntriesByTurn(
      [
        { hour: new Date("2026-11-20T10:00:00Z"), channel: "whatsapp", total: 3 },
        { hour: new Date("2026-11-20T11:00:00Z"), channel: "form", total: 5 },
        { hour: new Date("2026-11-19T12:00:00Z"), channel: "other", total: 1 },
        { hour: new Date("2026-11-01T12:00:00Z"), channel: "form", total: 9 },
      ],
      [t1, t2, new Date("2026-11-17T22:00:00Z")],
      turnOf,
    );
    expect(data.turns.map((turn) => [turn.start.toISOString(), turn.whatsapp, turn.form, turn.other, turn.total])).toEqual([
      [t1.toISOString(), 3, 5, 0, 8],
      [t2.toISOString(), 0, 0, 1, 1],
      ["2026-11-17T22:00:00.000Z", 0, 0, 0, 0],
    ]);
    expect(data.totals).toEqual({ whatsapp: 3, form: 5, other: 1, total: 9 });
  });

  it("CSV com cabeçalho, uma linha por turno e total; share sem divisão por zero", () => {
    const csv = entriesCsv(bucketEntriesByTurn([{ hour: new Date("2026-11-20T10:00:00Z"), channel: "whatsapp", total: 2 }], [t1], turnOf));
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Turno (início 19h);WhatsApp;Formulário;Outros;Total");
    expect(lines.at(-1)).toBe("Total;2;0;0;2");
    expect(share(1, 0)).toBe(0);
    expect(share(1, 3)).toBe(33);
  });
});
