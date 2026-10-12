// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh }) }));
vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  return { ...actual, useReducedMotion: () => true };
});

import { PresenceCallout } from "./presence-callout";
import type { PresenceAskView } from "./types";

const base: PresenceAskView = { assignmentId: "as1", scheduleName: "PME Manhã", branchName: "Centro", mode: "online", startsAt: "2026-10-12T12:00:00.000Z", endsAt: "2026-10-12T21:00:00.000Z", status: "pending", photoId: null };
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => "blob:local", revokeObjectURL: () => undefined }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("PresenceCallout", () => {
  it("online: one tap confirms", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    render(<PresenceCallout ask={base} />);
    expect(screen.getByText("Confirme sua presença")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar presença" }));
    expect(await screen.findByText("Presença confirmada")).toBeTruthy();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/duty/presence");
    expect((init.body as FormData).get("assignmentId")).toBe("as1");
    expect((init.body as FormData).get("photo")).toBeNull();
  });

  it("presencial: opens the camera, sends the photo and waits for the director (stays paused)", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true, awaitingRelease: true }) });
    const { container } = render(<PresenceCallout ask={{ ...base, mode: "presencial" }} />);
    expect(screen.getByText(/você precisa estar na unidade durante todo o plantão/)).toBeTruthy();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.getAttribute("capture")).toBe("environment");
    const click = vi.spyOn(input, "click");
    fireEvent.click(screen.getByRole("button", { name: /Tirar foto do local/ }));
    expect(click).toHaveBeenCalled();
    fireEvent.change(input, { target: { files: [new File(["x"], "local.jpg", { type: "image/jpeg" })] } });
    expect(await screen.findByText("Foto enviada")).toBeTruthy();
    expect(screen.getByText("Aguardando o diretor liberar")).toBeTruthy();
    expect(screen.getByText(/Até lá você fica pausado/)).toBeTruthy();
    expect(screen.queryByText("Presença confirmada")).toBeNull();
    expect((fetchMock.mock.calls[0][1].body as FormData).get("photo")).toBeTruthy();
    expect(screen.getByAltText("Foto do local do plantão")).toBeTruthy();
  });

  it("shows the server's reason and lets the broker try again", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ ok: false, error: "A gestão marcou falta neste plantão. Fale com ela." }) });
    render(<PresenceCallout ask={base} />);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar presença" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    await waitFor(() => expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeTruthy());
  });

  it("after a refresh, shows the photo already sent and turns into confirmed once released", () => {
    const waiting = { ...base, mode: "presencial" as const, status: "awaiting_release" as const, photoId: "8b0f2a8e-1111-4c1d-9e1a-123456789abc" };
    const { rerender } = render(<PresenceCallout ask={waiting} />);
    expect(screen.getByText("Foto enviada")).toBeTruthy();
    expect(screen.getByAltText("Foto do local do plantão").getAttribute("src")).toBe(`/api/duty/presence/photo?id=${waiting.photoId}`);
    rerender(<PresenceCallout ask={{ ...waiting, status: "confirmed" }} />);
    expect(screen.getByText("Presença confirmada")).toBeTruthy();
  });

  it("presencial: opens the camera inside the app and falls back to the phone camera when it cannot", async () => {
    const getUserMedia = vi.fn().mockRejectedValue(new Error("NotAllowedError"));
    Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia }, configurable: true });
    const { container } = render(<PresenceCallout ask={{ ...base, mode: "presencial" }} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const click = vi.spyOn(input, "click");
    fireEvent.click(screen.getByRole("button", { name: /Tirar foto do local/ }));
    expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({ video: expect.objectContaining({ facingMode: { ideal: "environment" } }) }));
    fireEvent.click(await screen.findByRole("button", { name: "Usar a câmera do celular" }));
    expect(click).toHaveBeenCalled();
    Object.defineProperty(navigator, "mediaDevices", { value: undefined, configurable: true });
  });
});
