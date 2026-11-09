// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh }) }));
vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  return { ...actual, useReducedMotion: () => true };
});

const gate = vi.fn();
vi.mock("@/features/lead-distribution/duty-presence-whatsapp-actions", () => ({ getPresenceWhatsAppGateAction: () => gate() }));
const connection = { tenantId: "t1", userId: "u1", sessionId: "s1", sessionName: "s1", status: "disconnected", qrCode: null, chatInternoAtivo: true, connectedAt: null };
vi.mock("@/app/(dashboard)/settings/whatsapp-actions", () => ({ getWhatsAppConnection: async () => connection }));
// O diálogo real conversa com o WhatsApp e desenha o roteiro guiado; aqui basta abrir, avisar "conectado" e
// tocar nos botões do roteiro (confirmar, ir para o plantão).
type GuideProps = { open?: boolean; variant?: string; onReady?: () => void; presence?: { stage: string; reconnect?: boolean; onConfirm: () => void; onFinish: () => void } };
vi.mock("@/components/whatsapp/whatsapp-connect-dialog", () => ({
  WhatsAppConnectDialog: (props: GuideProps) => props.open
    ? (
      <div role="dialog" aria-label="Conectar WhatsApp">
        <p>{props.variant} {props.presence?.stage}{props.presence?.reconnect ? " reconectar" : ""}</p>
        <button type="button" onClick={props.onReady}>Simular conectado</button>
        <button type="button" onClick={props.presence?.onConfirm}>Confirmar no roteiro</button>
        <button type="button" onClick={props.presence?.onFinish}>Ir para o Plantão</button>
      </div>
    )
    : null,
}));

import { PresenceCallout } from "./presence-callout";
import type { PresenceAskView } from "./types";

const base: PresenceAskView = { assignmentId: "as1", scheduleName: "PME Manhã", branchName: "Centro", mode: "online", startsAt: "2026-10-12T12:00:00.000Z", endsAt: "2026-10-12T21:00:00.000Z", status: "pending", photoId: null };
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  gate.mockReset();
  gate.mockResolvedValue({ required: false });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => "blob:local", revokeObjectURL: () => undefined }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("PresenceCallout: WhatsApp obrigatório (06/11)", () => {
  it("sem WhatsApp, abre o roteiro guiado; conectado, confirma com um toque dentro dele (09/11)", async () => {
    gate.mockResolvedValue({ required: true, connected: false, connection });
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    render(<PresenceCallout ask={base} />);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar presença" }));

    expect(await screen.findByRole("dialog", { name: "Conectar WhatsApp" })).toBeTruthy();
    expect(screen.getByText("presence connect")).toBeTruthy();
    expect(screen.getByText(/Falta conectar o seu WhatsApp/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continuar de onde parei" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Simular conectado" }));
    expect(await screen.findByText("presence confirm")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Confirmar no roteiro" }));
    expect(await screen.findByText("presence done")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Presença confirmada")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Ir para o Plantão" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(refresh).toHaveBeenCalled();
  });

  it("presencial sem WhatsApp: conecta antes e só depois abre a câmera", async () => {
    gate.mockResolvedValue({ required: true, connected: false, connection });
    const { container } = render(<PresenceCallout ask={{ ...base, mode: "presencial" }} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const click = vi.spyOn(input, "click");
    fireEvent.click(screen.getByRole("button", { name: /Tirar foto do local/ }));
    expect(await screen.findByRole("dialog", { name: "Conectar WhatsApp" })).toBeTruthy();
    expect(click).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Simular conectado" }));
    expect(click).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar no roteiro" }));
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("se o servidor disser que o WhatsApp caiu, abre a conexão e tenta de novo ao conectar", async () => {
    gate.mockResolvedValue({ required: true, connected: true, connection: { ...connection, status: "ready" } });
    fetchMock
      .mockResolvedValueOnce({ ok: false, json: async () => ({ ok: false, code: "whatsapp_required", error: "Conecte o seu WhatsApp para confirmar presença no plantão." }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
    render(<PresenceCallout ask={base} />);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar presença" }));
    expect(await screen.findByRole("dialog", { name: "Conectar WhatsApp" })).toBeTruthy();
    expect(screen.getByText("presence connect reconectar")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Simular conectado" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar no roteiro" }));
    expect(await screen.findByText("Presença confirmada")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("com a regra desligada, confirma como antes", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    render(<PresenceCallout ask={base} />);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar presença" }));
    expect(await screen.findByText("Presença confirmada")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("PresenceCallout", () => {
  it("online: one tap confirms", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    render(<PresenceCallout ask={base} />);
    expect(screen.getByText("PME Manhã · Centro")).toBeTruthy();
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
    await waitFor(() => expect(click).toHaveBeenCalled());
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
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({ video: expect.objectContaining({ facingMode: { ideal: "environment" } }) })));
    fireEvent.click(await screen.findByRole("button", { name: "Usar a câmera do celular" }));
    expect(click).toHaveBeenCalled();
    Object.defineProperty(navigator, "mediaDevices", { value: undefined, configurable: true });
  });
});
