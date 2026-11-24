// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock("./actions", () => ({
  distributeTeamListAction: vi.fn(),
  importTeamListAction: vi.fn(),
  renameTeamListAction: vi.fn(),
  reviewTeamListAction: vi.fn(),
  structureTeamListAction: vi.fn(),
}));

import { TeamListManager, listSummary } from "./team-list-manager";
import { TeamListsView } from "./team-lists-view";

const today = { id: "l2", name: "Lista 24/11", createdAt: "2026-11-24T17:05:00.000Z", importedBy: "Daianne Souza", imported: 120, duplicates: 8, rejected: 3, legacy: false, total: 120, pending: 40, replied: 5 };
const older = { id: "l1", name: "Lista 18/11", createdAt: "2026-11-18T12:00:00.000Z", importedBy: "Daianne Souza", imported: 30, duplicates: 0, rejected: 0, legacy: false, total: 30, pending: 0, replied: 9 };
const row = (id: string, listId: string, brokerId: string | null) => ({ id, name: `Contato ${id}`, phone: "5521987650000", status: brokerId ? "in_contact" : "new", brokerId, brokerName: brokerId ? "Ana" : null, replied: false, createdAt: today.createdAt, assignedAt: null, listId });

afterEach(() => { cleanup(); push.mockReset(); });

describe("listas importadas como pastas (DEC-191)", () => {
  it("mostra cada importação numa linha e abre a lista no clique", () => {
    const onOpenList = vi.fn();
    render(<TeamListsView lists={[today, older]} team={[]} pending={40} switcher={null} onOpenList={onOpenList} />);
    expect(screen.getAllByText("Lista 24/11").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Lista 18/11").length).toBeGreaterThan(0);
    expect(screen.getByText(/2 listas · 150 contatos · 40 para distribuir/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole("link", { name: "Lista 18/11" })[0]!);
    expect(onOpenList).toHaveBeenCalledWith("l1");
    expect(push).not.toHaveBeenCalled();
  });

  it("sem onOpenList, navega pela URL da lista", () => {
    render(<TeamListsView lists={[today]} team={[]} pending={40} switcher={null} />);
    fireEvent.click(screen.getAllByText("Lista 24/11")[0]!.closest("tr") ?? screen.getAllByText("Lista 24/11")[0]!);
    expect(push).toHaveBeenCalledWith("/leads?vista=lista&lista=l2");
  });

  it("resume a lista: quando, quem e o que ficou de fora", () => {
    expect(listSummary(today)).toMatch(/^Importada em 24\/11\/2026,? 14:05 por Daianne · 120 entraram · 8 duplicados · 3 fora$/);
    expect(listSummary({ ...older, legacy: true, duplicates: 0 })).toBe("Importada antes das listas separadas por Daianne · 30 entraram");
  });

  it("dentro da lista, mostra o nome, o filtro Lista e a volta para as pastas", () => {
    const onOpenList = vi.fn();
    render(<TeamListManager rows={[row("a", "l2", null)]} totals={{ all: 1, pending: 1, distributed: 0, replied: 0 }} team={[]} switcher={null} folders={{ current: today, all: [today, older], onOpenList }} />);
    expect(screen.getByRole("heading", { name: "Lista 24/11" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ações da Lista 24/11" })).toBeTruthy();
    fireEvent.click(screen.getByRole("link", { name: "Todas as listas" }));
    expect(onOpenList).toHaveBeenCalledWith(null);
  });

  it("em todos os contatos, cada linha diz a lista de origem", () => {
    render(<TeamListManager rows={[row("a", "l2", null), row("b", "l1", null)]} totals={{ all: 2, pending: 2, distributed: 0, replied: 0 }} team={[]} switcher={null} folders={{ current: null, all: [today, older] }} />);
    expect(screen.getByRole("heading", { name: "Todos os contatos" })).toBeTruthy();
    expect(screen.getByText("Lista 24/11 · (21) 98765-0000")).toBeTruthy();
    expect(screen.getByText("Lista 18/11 · (21) 98765-0000")).toBeTruthy();
  });
});
