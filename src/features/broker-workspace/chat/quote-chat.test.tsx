// @vitest-environment jsdom
import { cleanup, configure, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  return { ...actual, useReducedMotion: () => true };
});

import { QuoteChat } from "./quote-chat";

// Long flows: give the async queries room when the machine is busy.
configure({ asyncUtilTimeout: 4000 });
afterEach(() => cleanup());

function send(text: string) {
  const box = screen.getByRole("textbox");
  fireEvent.change(box, { target: { value: text } });
  fireEvent.keyDown(box, { key: "Enter" });
}

describe("QuoteChat", () => {
  it("guides the quote from the profile to a chosen plan", async () => {
    render(<QuoteChat />);
    expect(screen.getByText("0 de 6")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Família/ }));

    expect(await screen.findByText(/Quais as idades/)).toBeTruthy();
    expect(screen.getByPlaceholderText("Ex.: 35, 32, 8")).toBeTruthy();
    send("trinta");
    expect(await screen.findByText(/Não achei nenhuma idade/)).toBeTruthy();
    send("35, 32, 8");

    fireEvent.click(await screen.findByRole("button", { name: /Rio de Janeiro, capital/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Enfermaria/ }));
    fireEvent.click(await screen.findByRole("button", { name: /^.*Parcial/ }));
    expect(screen.getByText("5 de 6")).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: /Regional/ }));

    expect(await screen.findByText("Qual você quer apresentar?")).toBeTruthy();
    expect(screen.queryByText(/de 6$/)).toBeNull();
    const firstPlan = screen.getAllByRole("button").find((button) => /por mês/.test(button.textContent ?? ""));
    fireEvent.click(firstPlan!);
    expect(await screen.findByText("Simulação demonstrativa")).toBeTruthy();
    expect(await screen.findByRole("button", { name: /Enviar no WhatsApp/ })).toBeTruthy();
  }, 30_000);

  it("starts over on Refazer", async () => {
    render(<QuoteChat />);
    fireEvent.click(screen.getByRole("button", { name: /Pessoa física/ }));
    send("40");
    fireEvent.click(await screen.findByRole("button", { name: /Rio de Janeiro, capital/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Enfermaria/ }));
    fireEvent.click(await screen.findByRole("button", { name: /^.*Parcial/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Regional/ }));
    await screen.findByText("Qual você quer apresentar?");
    fireEvent.click(screen.getAllByRole("button").find((button) => /por mês/.test(button.textContent ?? ""))!);
    await screen.findByText("Simulação demonstrativa");
    fireEvent.click(await screen.findByRole("button", { name: /Refazer a cotação/ }));
    expect(await screen.findByText("0 de 6")).toBeTruthy();
    expect(screen.queryByText("Qual você quer apresentar?")).toBeNull();
  }, 30_000);
});
