import { describe, expect, it } from "vitest";

import { sortQueuesByBacklog } from "./queues-table";

describe("ordem das filas", () => {
  it("mais leads aguardando primeiro, empate pelo nome", () => {
    const sorted = sortQueuesByBacklog([
      { name: "Venâncio Leads", waiting: 2 },
      { name: "CALLEX", waiting: 178 },
      { name: "Whatsapp Renan", waiting: 0 },
      { name: "Telefone Recepção", waiting: 0 },
      { name: "FILA TATIANA", waiting: 169 },
    ]);
    expect(sorted.map((queue) => queue.name)).toEqual(["CALLEX", "FILA TATIANA", "Venâncio Leads", "Telefone Recepção", "Whatsapp Renan"]);
  });
});
