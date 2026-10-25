// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LiteKanban } from "./kanban";

afterEach(cleanup);

type Card = { id: string; name: string };

const columns = [
  { id: "new", title: "Novo", items: [{ id: "a", name: "Ana" }, { id: "b", name: "Bia" }] },
  { id: "in_contact", title: "Em atendimento", items: [{ id: "c", name: "Caio" }] },
  { id: "converted", title: "Convertido", items: [] as Card[] },
];

function renderBoard(onMoveColumn = vi.fn()) {
  render(<LiteKanban<Card> label="Funil" columns={columns} itemKey={(card) => card.id} renderCard={(card) => <span>{card.name}</span>} onMoveColumn={onMoveColumn} />);
  return { onMoveColumn };
}

const status = () => document.querySelector("[data-lite-announcer]") as HTMLElement;
const titles = () => screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
const tick = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

describe("LiteKanban", () => {
  it("mostra colunas, contagem, cartões e o vazio", () => {
    renderBoard();
    expect(titles()).toEqual(["Novo", "Em atendimento", "Convertido"]);
    const items = within(screen.getByRole("region", { name: "Funil" })).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual(["Ana", "Bia", "Caio"]);
    expect(screen.getByLabelText("2 leads")).toHaveTextContent("2");
    expect(screen.getByLabelText("1 lead")).toHaveTextContent("1");
    expect(screen.getByText("Nenhum lead nesta etapa")).toBeInTheDocument();
  });

  it("teclado: espaço pega, setas movem com prévia, espaço solta e avisa a mudança", async () => {
    const { onMoveColumn } = renderBoard();
    const handle = screen.getByRole("button", { name: /Mover coluna Novo, posição 1 de 3/ });
    handle.focus();
    fireEvent.keyDown(handle, { key: " " });
    expect(status()).toHaveTextContent("Coluna Novo pega, posição 1 de 3");
    expect(handle).toHaveAttribute("aria-pressed", "true");
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    await tick();
    expect(titles()).toEqual(["Em atendimento", "Novo", "Convertido"]);
    expect(status()).toHaveTextContent("Coluna Novo na posição 2 de 3.");
    fireEvent.keyDown(screen.getByRole("button", { name: /Mover coluna Novo/ }), { key: "End" });
    await tick();
    expect(status()).toHaveTextContent("posição 3 de 3");
    fireEvent.keyDown(screen.getByRole("button", { name: /Mover coluna Novo/ }), { key: " " });
    await tick();
    expect(onMoveColumn).toHaveBeenCalledWith("new", "converted");
    expect(status()).toHaveTextContent("Coluna Novo solta na posição 3 de 3.");
    expect(screen.getByRole("button", { name: /Mover coluna Novo/ })).toHaveFocus();
  });

  it("Esc cancela e volta a coluna para o lugar", async () => {
    const { onMoveColumn } = renderBoard();
    const handle = screen.getByRole("button", { name: /Mover coluna Em atendimento/ });
    handle.focus();
    fireEvent.keyDown(handle, { key: "Enter" });
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    await tick();
    expect(titles()[0]).toBe("Em atendimento");
    fireEvent.keyDown(screen.getByRole("button", { name: /Mover coluna Em atendimento/ }), { key: "Escape" });
    await tick();
    expect(titles()).toEqual(["Novo", "Em atendimento", "Convertido"]);
    expect(onMoveColumn).not.toHaveBeenCalled();
    expect(status()).toHaveTextContent("Movimento cancelado. Coluna Em atendimento voltou para a posição 2.");
  });

  it("soltar no mesmo lugar não move nada", () => {
    const { onMoveColumn } = renderBoard();
    const handle = screen.getByRole("button", { name: /Mover coluna Novo/ });
    fireEvent.keyDown(handle, { key: " " });
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    fireEvent.keyDown(handle, { key: " " });
    expect(onMoveColumn).not.toHaveBeenCalled();
  });
});
