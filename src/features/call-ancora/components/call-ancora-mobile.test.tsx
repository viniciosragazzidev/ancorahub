// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/feedback/use-feedback", () => ({ useFeedback: () => vi.fn() }));

import { CALL_ANCORA_DEMO_CONTACTS } from "../contacts";
import { CALL_ANCORA_MOBILE_SESSION_ENDED_MESSAGE } from "../mobile-session";
import type { CallAncoraSnapshot } from "../session-store";
import { CallAncoraMobile } from "./call-ancora-workspace";

const session: CallAncoraSnapshot = {
  sessionId: "session-1",
  brokerFirstName: "Ana",
  status: "active",
  pairedAt: "2026-11-19T12:00:00.000Z",
  current: CALL_ANCORA_DEMO_CONTACTS[0] ?? null,
  next: CALL_ANCORA_DEMO_CONTACTS[1] ?? null,
  callStatus: "ready",
  callStartedAt: null,
  callElapsedSeconds: 0,
  interests: [],
  completed: 0,
  total: CALL_ANCORA_DEMO_CONTACTS.length,
  queueSource: "demo",
  autoDialEnabled: false,
  awaitingClassification: false,
  devicePaused: false,
  lastCall: null,
  lastOutcome: null,
  hangupRequested: false,
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
  it("inicia a próxima simulação sem toque quando a discagem automática está ligada", async () => {
    const nextContactSession: CallAncoraSnapshot = {
      ...session,
      current: CALL_ANCORA_DEMO_CONTACTS[1] ?? null,
      next: CALL_ANCORA_DEMO_CONTACTS[2] ?? null,
      completed: 1,
      autoDialEnabled: true,
    };
    const transitions: string[] = [];
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") return apiResponse(200, { deviceToken: "device-token", session: nextContactSession });
      if (init?.method === "PATCH") {
        const body = JSON.parse(String(init.body)) as { callStatus: string };
        transitions.push(body.callStatus);
        return apiResponse(200, { session: { ...nextContactSession, callStatus: body.callStatus } });
      }
      return apiResponse(200, { session: nextContactSession });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CallAncoraMobile token="pairing-token" />);
    await waitFor(() => expect(transitions).toEqual(["dialing", "ringing", "active", "ended"]), { timeout: 9_000, interval: 20 });

    expect(transitions).toEqual(["dialing", "ringing", "active", "ended"]);
    expect(screen.getByText("Discagem automática ligada")).toBeInTheDocument();
    expect(screen.getByText(/Nenhuma ligação real começa sozinha no navegador/)).toBeInTheDocument();
  }, 10_000);

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
