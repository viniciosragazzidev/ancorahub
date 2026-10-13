// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  return { ...actual, useReducedMotion: () => true };
});

import { TipHost } from "./tip-host";

const tip = { id: "awaiting_response:l2:2026-10-12", leadId: "l2", title: "Maria está esperando você", text: "Escreveu há 2h.", cta: { label: "Responder Maria", href: "/leads/l2" }, tone: "urgent" };
const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ tip }) }) as unknown as Response);

beforeEach(() => { vi.useFakeTimers(); window.localStorage.clear(); fetchMock.mockClear(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

async function tick(ms: number) {
  await act(async () => { vi.advanceTimersByTime(ms); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
}

describe("TipHost", () => {
  it("pops one tip after a while, with one tap to act, and never repeats it or floods", async () => {
    render(<TipHost />);
    await tick(26_000);
    expect(screen.getByText("Maria está esperando você")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Responder Maria" }).getAttribute("href")).toBe("/leads/l2");
    fireEvent.click(screen.getByRole("button", { name: "Agora não" }));
    await tick(1_000);
    expect(screen.queryByRole("status")).toBeNull();
    // Next check is inside the 20-min cooldown: no request, no tip.
    await tick(8 * 60_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // After the cooldown the same tip id is not shown again.
    await tick(16 * 60_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("status")).toBeNull();
  });
});
