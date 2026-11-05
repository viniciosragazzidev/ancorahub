import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/features/lead-distribution/monthly-duty-actions", () => ({}));
vi.mock("@/features/lead-distribution/duty-type-actions", () => ({}));

import { sortQualified } from "./monthly-duty-planner";

const PME = "pme";
const OUTRO = "outro";
const names: Record<string, string> = { b1: "Carla Souza", b2: "ana Lima", b3: "Bruno Reis", b4: "Álvaro Dias" };
const entry = (brokerId: string, seats: Record<string, number>) => ({ brokerId, allowed: Object.keys(seats), seats });
const entries = [entry("b1", { [PME]: 2 }), entry("b2", { [PME]: 5 }), entry("b3", { [PME]: 2, [OUTRO]: 9 }), entry("b4", { [PME]: 1 })];
const ids = (list: readonly { brokerId: string }[]) => list.map((item) => item.brokerId);
const nameOf = (id: string) => names[id] ?? "";

describe("ordenar corretores da escala", () => {
  it("Adicionados mantém a ordem em que entraram", () => {
    expect(ids(sortQualified(entries, "added", new Set([PME]), nameOf))).toEqual(["b1", "b2", "b3", "b4"]);
  });

  it("Cadeiras põe quem tem mais cadeiras primeiro, contando só os tipos escolhidos; empate vai por nome", () => {
    expect(ids(sortQualified(entries, "seats", new Set([PME]), nameOf))).toEqual(["b2", "b3", "b1", "b4"]);
    expect(ids(sortQualified(entries, "seats", new Set([PME, OUTRO]), nameOf))).toEqual(["b3", "b2", "b1", "b4"]);
  });

  it("A–Z ordena pelo nome, sem ligar para maiúscula ou acento", () => {
    expect(ids(sortQualified(entries, "name", new Set([PME]), nameOf))).toEqual(["b4", "b2", "b3", "b1"]);
  });

  it("não altera a lista original", () => {
    const original = ids(entries);
    sortQualified(entries, "name", new Set([PME]), nameOf);
    expect(ids(entries)).toEqual(original);
  });
});
