// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/feedback/use-feedback", () => ({ useFeedback: () => vi.fn() }));

import { CALL_ANCORA_DEFAULT_SETTINGS } from "../settings-rules";
import { CallAncoraSettingsPanel } from "./call-ancora-settings";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("configurações do Call Âncora (diretor)", () => {
  it("mostra e salva as regras de desligamento automático", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const settings = init?.method === "PUT" ? JSON.parse(String(init.body)) : CALL_ANCORA_DEFAULT_SETTINGS;
      return new Response(JSON.stringify({ settings }), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CallAncoraSettingsPanel />);
    expect(await screen.findByText("Desligar sozinho caixa postal e não atendidas")).toBeTruthy();
    const ring = screen.getByLabelText(/Tempo de toque/) as HTMLInputElement;
    expect(ring.value).toBe("22");
    fireEvent.change(ring, { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar configurações" }));

    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(true));
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
    expect(JSON.parse(String(put?.[1]?.body))).toMatchObject({ ringTimeoutSeconds: 30, autoHangupEnabled: true });
  });

  it("salva a data de início e mostra quantos frios ficam fora", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const settings = init?.method === "PUT" ? JSON.parse(String(init.body)) : CALL_ANCORA_DEFAULT_SETTINGS;
      return new Response(JSON.stringify({ settings, outsideByDate: settings.leadsFromDate ? 37 : 0 }), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CallAncoraSettingsPanel />);
    const date = await screen.findByLabelText("Só leads a partir de") as HTMLInputElement;
    expect(date.value).toBe("");
    fireEvent.change(date, { target: { value: "2026-11-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar configurações" }));

    expect(await screen.findByText(/frios ficam fora da fila por ser de antes de 01\/11\/2026/)).toBeTruthy();
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
    expect(JSON.parse(String(put?.[1]?.body))).toMatchObject({ leadsFromDate: "2026-11-01" });
  });
});
