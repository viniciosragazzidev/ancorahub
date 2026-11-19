// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
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
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("CallAncoraMobile", () => {
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
