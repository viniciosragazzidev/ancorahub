// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ update: vi.fn(), fire: vi.fn(), toastError: vi.fn() }));
vi.mock("@/features/leads/availability-action", () => ({ updateBrokerAvailabilityAction: mocks.update }));
vi.mock("@/lib/feedback/use-feedback", () => ({ useFeedback: () => mocks.fire }));
vi.mock("@/components/ui/sonner", () => ({ toast: { error: mocks.toastError } }));

import { LightAvailabilityPill, useLightAvailability } from "./light-top-nav";

function Harness({ inlineError = false }: { inlineError?: boolean }) {
  const { availability, isPending, error, setStatus } = useLightAvailability("available");
  return (
    <>
      <LightAvailabilityPill availability={availability} isPending={isPending} onToggle={() => setStatus(availability === "available" ? "paused" : "available", { inlineError })} />
      {error ? <p data-testid="erro">{error}</p> : null}
    </>
  );
}

afterEach(() => cleanup());
beforeEach(() => {
  mocks.update.mockReset().mockResolvedValue(undefined);
  mocks.fire.mockReset();
  mocks.toastError.mockReset();
});

describe("pausar o recebimento (nível 1)", () => {
  it("só troca depois do servidor e confirma com check e som discreto", async () => {
    render(<Harness />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Disponível para receber leads/ })); });
    await waitFor(() => expect(screen.getByRole("button", { name: /Pausado/ })).toBeTruthy());
    expect(mocks.update).toHaveBeenCalledWith("paused");
    expect(mocks.fire).toHaveBeenCalledWith("tap");
    expect(mocks.fire).toHaveBeenCalledWith("confirm", { sound: true });
    expect(screen.getByRole("status").textContent).toBe("Pausado");
  });

  it("falha diz a causa e que nada mudou; o toast fica de fora quando a tela mostra o erro", async () => {
    mocks.update.mockRejectedValueOnce(new Error("Failed to fetch"));
    render(<Harness inlineError />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Disponível para receber leads/ })); });
    await waitFor(() => expect(screen.getByTestId("erro").textContent).toBe("Sem conexão agora. Você continua recebendo leads."));
    expect(mocks.fire).toHaveBeenCalledWith("error");
    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Disponível para receber leads/ })).toBeTruthy();
  });

  it("no cabeçalho (sem lugar para texto) o erro normalizado vai num toast", async () => {
    mocks.update.mockRejectedValueOnce(new Error("Apenas corretores podem alterar a própria disponibilidade."));
    render(<Harness />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Disponível para receber leads/ })); });
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("Apenas corretores podem alterar a própria disponibilidade. Você continua recebendo leads."));
  });
});
