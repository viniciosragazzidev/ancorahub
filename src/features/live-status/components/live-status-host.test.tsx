// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { dispatchRealtimeSyncEvent } from "@/components/providers/realtime-events";
import { resetCountdownClockForTests } from "@/components/lite/status/use-countdown";

import type { LiveStatus, LiveStatusPayload } from "../types";
import { LIVE_STATUS_DUE_GRACE_MS, LIVE_STATUS_POLL_MS, LIVE_STATUS_SIGNAL_DEBOUNCE_MS, LiveStatusHost } from "./live-status-host";

const GENERATED = "2026-10-27T13:00:00.000Z";
const status = (value: number, overrides: Partial<LiveStatus> = {}): LiveStatus => ({
  id: "ofertas", label: "Ofertas aguardando aceite", value, emptyText: "Nenhuma oferta", severity: "info", explanation: "Frase.", generatedAt: GENERATED, ...overrides,
});
const payload = (value: number): LiveStatusPayload => ({ statuses: [status(value)], seals: [] });

const fetchMock = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(GENERATED));
  resetCountdownClockForTests();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ enabled: true, ...payload(7) }) });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  resetCountdownClockForTests();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function flush() {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

describe("LiveStatusHost", () => {
  it("primeira pintura com o dado do servidor, sem buscar", () => {
    render(<LiveStatusHost initial={payload(3)} />);
    expect(screen.getByRole("region", { name: "Agora na operação" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("busca de novo a cada 60 s com a aba visível, sem recarregar a página", async () => {
    render(<LiveStatusHost initial={payload(3)} />);
    await act(async () => { vi.advanceTimersByTime(LIVE_STATUS_POLL_MS); });
    await flush();
    expect(fetchMock).toHaveBeenCalledWith("/api/live-status", { cache: "no-store" });
    // O leitor de tela recebe o número novo (região educada do LiteNumber).
    expect(document.querySelector('[aria-live="polite"]')?.textContent).toBe("7");
  });

  it("contagem que chega a zero busca depois da folga de 20 s", async () => {
    const initial: LiveStatusPayload = { statuses: [status(2, { nextEvent: { at: "2026-10-27T13:00:02.000Z", label: "A primeira expira" } })], seals: [] };
    render(<LiveStatusHost initial={initial} />);
    await act(async () => { vi.advanceTimersByTime(2_000); });
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(LIVE_STATUS_DUE_GRACE_MS); });
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sinal do tempo real de leads busca na hora (juntando a rajada); conversas não", async () => {
    render(<LiveStatusHost initial={payload(3)} />);
    act(() => {
      dispatchRealtimeSyncEvent({ kind: "domain.invalidated", domain: "conversations" });
    });
    await act(async () => { vi.advanceTimersByTime(LIVE_STATUS_SIGNAL_DEBOUNCE_MS); });
    expect(fetchMock).not.toHaveBeenCalled();
    act(() => {
      dispatchRealtimeSyncEvent({ kind: "domain.invalidated", domain: "leads" });
      dispatchRealtimeSyncEvent({ kind: "domain.invalidated", domain: "leads" });
    });
    await act(async () => { vi.advanceTimersByTime(LIVE_STATUS_SIGNAL_DEBOUNCE_MS); });
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("chave desligada no meio do caminho: a faixa some", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ enabled: false, statuses: [], seals: [] }) });
    const { container } = render(<LiveStatusHost initial={payload(3)} />);
    await act(async () => { vi.advanceTimersByTime(LIVE_STATUS_POLL_MS); });
    await flush();
    expect(container).toBeEmptyDOMElement();
  });
});
