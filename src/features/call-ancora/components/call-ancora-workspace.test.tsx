// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const fire = vi.fn();
vi.mock("@/lib/feedback/use-feedback", () => ({ useFeedback: () => fire }));

import { DevLabProvider } from "@/lib/dev-lab";

import { buildQrShape } from "./call-ancora-motion";
import { CallAncoraWorkspace } from "./call-ancora-workspace";

afterEach(() => {
  cleanup();
  fire.mockClear();
});

describe("Call Âncora: demonstração no laboratório", () => {
  it("passa pelo QR, mostra Celular conectado e abre a sessão no primeiro contato", async () => {
    render(<DevLabProvider value={{}}><CallAncoraWorkspace brokerFirstName="Ana" /></DevLabProvider>);

    expect(screen.getByRole("heading", { name: "Uma conversa de cada vez." })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Iniciar/ }));

    expect(await screen.findByRole("img", { name: "QR code de pareamento do Call Âncora" })).toBeTruthy();
    expect(screen.getByText(/Expira em/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Simular leitura do QR/ }));
    expect(await screen.findByRole("heading", { name: "Celular conectado" })).toBeTruthy();
    expect(fire).toHaveBeenCalledWith("confirm");

    await waitFor(() => expect(screen.getByRole("heading", { name: "Marina Duarte" })).toBeTruthy(), { timeout: 3_000 });
    expect(screen.getByText("Celular conectado")).toBeTruthy();
    expect(screen.getByText("Próximo contato")).toBeTruthy();
    expect(screen.getByText("Rafael Nogueira")).toBeTruthy();
    await act(async () => {});
  });
});

describe("buildQrShape", () => {
  it("separa os três quadrados de posição do resto da matriz", () => {
    const shape = buildQrShape("https://exemplo.test/call-ancora/celular?t=abc");
    expect(shape.size).toBeGreaterThanOrEqual(21);
    expect(shape.finders).toEqual([[0, 0], [0, shape.size - 7], [shape.size - 7, 0]]);
    expect(shape.data.startsWith("M")).toBe(true);
  });
});
