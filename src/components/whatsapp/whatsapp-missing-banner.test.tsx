// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const connection = { tenantId: "t1", userId: "u1", sessionId: "s1", sessionName: "s1", status: "disconnected", qrCode: null, chatInternoAtivo: true, connectedAt: null };
const getConnection = vi.fn();
const getStatus = vi.fn();
vi.mock("@/app/(dashboard)/settings/whatsapp-actions", () => ({ getWhatsAppConnection: () => getConnection(), getWhatsAppSessionStatus: () => getStatus() }));
vi.mock("@/components/light/use-top-strip", () => ({ useTopStrip: () => undefined }));
// O diálogo real conversa com o WhatsApp; aqui basta ver qual tela a faixa pede e simular abrir, conectar e fechar.
vi.mock("./whatsapp-connect-dialog", () => ({
  WhatsAppConnectDialog: (props: { variant?: string; guideMode?: string; trigger: React.ReactElement; onOpenChange?: (open: boolean) => void; onConnectionChanged?: () => void }) => (
    <div>
      <p>{props.variant} {props.guideMode}</p>
      {props.trigger}
      <button type="button" onClick={() => props.onOpenChange?.(true)}>abrir</button>
      <button type="button" onClick={() => props.onConnectionChanged?.()}>conectou</button>
      <button type="button" onClick={() => props.onOpenChange?.(false)}>fechar</button>
    </div>
  ),
}));

import type * as React from "react";
import { WhatsAppMissingBanner } from "./whatsapp-missing-banner";

afterEach(() => { cleanup(); getConnection.mockReset(); getStatus.mockReset(); });

describe("faixa de WhatsApp desconectado no topo (11/11)", () => {
  it("Conectar agora abre o roteiro guiado, só para conectar", async () => {
    getConnection.mockResolvedValue(connection);
    render(<WhatsAppMissingBanner />);
    expect(await screen.findByText("presence connect")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Conectar agora" })).toBeTruthy();
  });

  it("conectado com o roteiro aberto, a faixa só sai quando o roteiro fecha", async () => {
    getConnection.mockResolvedValue(connection);
    getStatus.mockResolvedValue({ success: true, status: "ready" });
    render(<WhatsAppMissingBanner />);
    await screen.findByText("presence connect");
    fireEvent.click(screen.getByRole("button", { name: "abrir" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "conectou" })); });
    expect(screen.getByText("presence connect")).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "fechar" })); });
    expect(screen.queryByText("presence connect")).toBeNull();
  });
});
