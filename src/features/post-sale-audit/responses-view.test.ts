import { describe, expect, it } from "vitest";

import { answerChips, matchesSearch, paginate } from "./responses-view";

describe("paginate", () => {
  it("mostra 10 por página e ajusta página fora do intervalo", () => {
    const items = Array.from({ length: 23 }, (_, i) => i);
    expect(paginate(items, 1).items).toHaveLength(10);
    expect(paginate(items, 3).items).toEqual([20, 21, 22]);
    expect(paginate(items, 9).page).toBe(3);
    expect(paginate([], 1)).toMatchObject({ page: 1, pages: 1, total: 0 });
  });
});

describe("matchesSearch", () => {
  it("ignora acento e maiúscula", () => {
    expect(matchesSearch(["Vitória Gesteira", "Alan Chile"], "vitoria")).toBe(true);
    expect(matchesSearch(["Ana"], "")).toBe(true);
    expect(matchesSearch(["Ana", null], "bruno")).toBe(false);
  });
});

describe("answerChips", () => {
  it("resume atendimento, nota, ajuda e recusa", () => {
    expect(answerChips({ status: "completed", outcome: "no_contact", rating: null, answers: { contacted: false, wantsHelp: true } }).map((c) => c.label)).toEqual(["Não foi atendido", "Quer ajuda"]);
    expect(answerChips({ status: "answering", outcome: null, rating: null, answers: { rating: 5, contacted: true } }).map((c) => c.label)).toEqual(["Foi atendido", "Nota 5/5"]);
    expect(answerChips({ status: "completed", outcome: "other", rating: null, answers: { comment: "Agora não" } }).map((c) => c.label)).toEqual(["Agora não"]);
    expect(answerChips({ status: "opted_out", outcome: null, rating: null, answers: {} }).map((c) => c.label)).toEqual(["Pediu para parar"]);
  });
});
