// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { BottomSheet } from "./bottom-sheet";

function Opener() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Abrir ajuda</button>
      <button type="button">Outro botão</button>
      <BottomSheet open={open} onOpenChange={setOpen} title="Ajuda" closeLabel="Fechar">
        <p>Conteúdo</p>
        <button type="button" onClick={() => setOpen(false)}>Pronto</button>
      </BottomSheet>
    </>
  );
}

afterEach(() => cleanup());

describe("BottomSheet without a trigger", () => {
  it("gives the focus back to what opened it when it closes", async () => {
    render(<Opener />);
    const opener = screen.getByRole("button", { name: "Abrir ajuda" });
    opener.focus();
    fireEvent.click(opener);
    expect(await screen.findByText("Conteúdo")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Pronto" }));
    (document.activeElement as HTMLElement | null)?.blur();
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 450)); });
    expect(document.activeElement).toBe(opener);
  });
});

describe("BottomSheet with a trigger", () => {
  it("uses the supplied button as the trigger without nesting buttons", async () => {
    render(<BottomSheet trigger={<button type="button">Abrir painel</button>} title="Painel" closeLabel="Fechar"><p>Conteúdo do painel</p></BottomSheet>);
    const trigger = screen.getByRole("button", { name: "Abrir painel" });
    expect(trigger.querySelector("button")).toBeNull();
    fireEvent.click(trigger);
    expect(await screen.findByText("Conteúdo do painel")).toBeTruthy();
  });
});
