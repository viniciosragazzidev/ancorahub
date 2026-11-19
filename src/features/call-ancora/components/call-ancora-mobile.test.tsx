// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/feedback/use-feedback", () => ({ useFeedback: () => vi.fn() }));

import type { CallAncoraContact } from "../contacts";

const CONTACTS: CallAncoraContact[] = [1, 2, 3].map((n) => ({
  id: `teste-${n}`,
  name: `Contato ${n}`,
  phone: `+552199999000${n}`,
  source: "test_list",
  dialable: true,
}));
import { CALL_ANCORA_MOBILE_SESSION_ENDED_MESSAGE } from "../mobile-session";
import type { CallAncoraSnapshot } from "../session-store";
import { CallAncoraMobile } from "./call-ancora-workspace";

const session: CallAncoraSnapshot = {
  sessionId: "session-1",
  brokerFirstName: "Ana",
  status: "active",
  pairedAt: "2026-11-19T12:00:00.000Z",
  current: CONTACTS[0] ?? null,
  next: CONTACTS[1] ?? null,
  callStatus: "ready",
  callStartedAt: null,
  callElapsedSeconds: 0,
  interests: [],
  completed: 0,
  total: CONTACTS.length,
  queueSource: "test_list",
  autoDialEnabled: false,
  awaitingClassification: false,
  devicePaused: false,
  lastCall: null,
  lastOutcome: null,
  hangupRequested: false,
  hangupRequest: null,
  runState: "running",
  pausedBy: null,
  version: 1,
  phone: null,
  countdown: null,
  updatedAt: "2026-11-19T12:00:00.000Z",
};

function apiResponse(status: number, body: Record<string, unknown>) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("CallAncoraMobile", () => {
  it("no navegador não simula nem disca sozinho, mesmo com a discagem automática ligada", async () => {
    const nextContactSession: CallAncoraSnapshot = {
      ...session,
      current: CONTACTS[1] ?? null,
      next: CONTACTS[2] ?? null,
      completed: 1,
      autoDialEnabled: true,
    };
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") return apiResponse(200, { deviceToken: "device-token", session: nextContactSession });
      return apiResponse(200, { session: nextContactSession });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CallAncoraMobile token="pairing-token" />);
    expect(await screen.findByText("Discagem automática ligada")).toBeInTheDocument();
    expect(screen.getByText(/No navegador, cada ligação precisa de um toque/)).toBeInTheDocument();
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2));
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(false);
  });

  it("deixa o telefone destacado e abre tel: somente pelo toque explícito", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => init?.method === "POST"
      ? apiResponse(200, { deviceToken: "device-token", session })
      : apiResponse(200, { session })));

    render(<CallAncoraMobile token="pairing-token" />);

    const dial = await screen.findByRole("link", { name: "Ligar para o próximo" });
    expect(dial).toHaveAttribute("href", expect.stringMatching(/^tel:/));
    expect(screen.getByText(session.current?.phone ?? "")).toHaveClass("text-2xl");
  });

  it.each([401, 403])("encerra a consulta e pede um novo QR após HTTP %i", async (status) => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") return apiResponse(200, { deviceToken: "device-token", session });
      return apiResponse(status, { error: "sessão inválida" });
    });
    vi.stubGlobal("fetch", fetchMock);

    let nextTimerId = 0;
    const activeTimers = new Map<number, TimerHandler>();
    vi.spyOn(window, "setInterval").mockImplementation(((handler: TimerHandler) => {
      const id = ++nextTimerId;
      activeTimers.set(id, handler);
      return id;
    }) as typeof window.setInterval);
    vi.spyOn(window, "clearInterval").mockImplementation((id) => {
      activeTimers.delete(Number(id));
    });

    render(<CallAncoraMobile token="pairing-token" />);

    expect(await screen.findByText(CALL_ANCORA_MOBILE_SESSION_ENDED_MESSAGE)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Sessão encerrada");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(activeTimers.size).toBe(0);

    await act(async () => {
      for (const handler of activeTimers.values()) {
        if (typeof handler === "function") handler();
      }
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
