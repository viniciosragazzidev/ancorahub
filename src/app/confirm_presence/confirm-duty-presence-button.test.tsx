// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConfirmDutyPresenceButton } from "./confirm-duty-presence-button";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("confirmação de presença", () => {
  it("mostra a ação inicial, permite repetir após falha e só confirma após sucesso do servidor", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Conexão indisponível." }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });
    vi.stubGlobal("fetch", fetchMock);

    render(<ConfirmDutyPresenceButton confirmationId="confirmation-id" />);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar presença" }));

    const retry = await screen.findByRole("button", { name: "Tentar novamente" });
    expect(retry).toBeEnabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Conexão indisponível.");

    fireEvent.click(retry);
    await waitFor(() => expect(screen.getByRole("button", { name: "Presença confirmada" })).toBeDisabled());
    expect(screen.getByRole("status")).toHaveTextContent("Presença registrada.");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
