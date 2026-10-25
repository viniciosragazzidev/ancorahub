import { describe, expect, it } from "vitest";

import { formatLiteDate, liteDateFormatter } from "./date";

describe("datas do Lite no fuso de São Paulo", () => {
  // 22:30 em Brasília do dia 24 já é dia 25 em UTC: o Lite tem de mostrar 24.
  const lateEvening = "2026-10-25T01:30:00.000Z";

  it("formata 22:30 BRT com a data de Brasília, não a de UTC", () => {
    expect(formatLiteDate(lateEvening)).toBe("24/10/2026");
    expect(liteDateFormatter({ day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(lateEvening))).toBe("24/10, 22:30");
    expect(liteDateFormatter({ dateStyle: "short" }).format(new Date(lateEvening))).toBe("24/10/2026");
  });

  it("valor vazio ou inválido vira o texto de reserva", () => {
    expect(formatLiteDate(null)).toBe("Sem data");
    expect(formatLiteDate("não é data", undefined, "Não informado")).toBe("Não informado");
  });
});
