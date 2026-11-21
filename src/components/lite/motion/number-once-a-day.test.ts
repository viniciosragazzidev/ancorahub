// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import { countsToday } from "./number";

/** FEEDBACK.md: número que rola é nível 2, no máximo uma vez por dia por tipo (aqui, por rota). */
describe("LiteNumber conta do zero só na primeira visita do dia", () => {
  beforeEach(() => window.localStorage.clear());

  it("a primeira visita conta, e os números que montam juntos seguem a mesma decisão", () => {
    const now = new Date("2026-11-20T12:00:00-03:00");
    expect(countsToday("/desempenho", now)).toBe(true);
    expect(countsToday("/desempenho", new Date(now.getTime() + 200))).toBe(true);
  });

  it("voltar à mesma rota no mesmo dia mostra o número pronto", () => {
    const now = new Date("2026-11-20T13:00:00-03:00");
    expect(countsToday("/plantoes", now)).toBe(true);
    expect(countsToday("/plantoes", new Date(now.getTime() + 60_000))).toBe(false);
  });

  it("no dia seguinte volta a contar", () => {
    const now = new Date("2026-11-20T15:00:00-03:00");
    expect(countsToday("/negociacoes", now)).toBe(true);
    expect(countsToday("/negociacoes", new Date("2026-11-21T09:00:00-03:00"))).toBe(true);
  });
});
