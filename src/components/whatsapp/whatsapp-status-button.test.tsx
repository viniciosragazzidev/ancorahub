// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const connection = { tenantId: "t1", userId: "u1", sessionId: "s1", sessionName: "s1", status: "disconnected", qrCode: null, chatInternoAtivo: true, connectedAt: null };
const getConnection = vi.fn();
vi.mock("@/app/(dashboard)/settings/whatsapp-actions", () => ({ getWhatsAppConnection: () => getConnection(), getWhatsAppSessionStatus: async () => ({ success: false }) }));
vi.mock("@/components/chat/tour/seen-storage", () => ({ isViewingAs: () => false }));
// O diálogo real conversa com o WhatsApp; aqui basta ver qual tela o botão pede e simular abrir/fechar.
vi.mock("./whatsapp-connect-dialog", () => ({
  WhatsAppConnectDialog: (props: { variant?: string; guideMode?: string; trigger: React.ReactElement; onOpenChange?: (open: boolean) => void }) => (
    <div>
      <p>{props.variant} {props.guideMode}</p>
      {props.trigger}
      <button type="button" onClick={() => props.onOpenChange?.(true)}>abrir</button>
    </div>
  ),
}));

import type * as React from "react";
import { WhatsAppStatusButton } from "./whatsapp-status-button";

afterEach(() => { cleanup(); getConnection.mockReset(); });

describe("botão do WhatsApp no topo (10/11)", () => {
  it("desconectado: abre o roteiro guiado, só para conectar", async () => {
    getConnection.mockResolvedValue(connection);
    render(<WhatsAppStatusButton />);
    expect(await screen.findByText("presence connect")).toBeTruthy();
    expect(screen.getByRole("button", { name: /toque para conectar/ })).toBeTruthy();
  });

  it("conectado: mantém o painel de sempre (status e desconectar)", async () => {
    getConnection.mockResolvedValue({ ...connection, status: "ready" });
    render(<WhatsAppStatusButton />);
    expect(await screen.findByText("default connect")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "abrir" }));
    expect(screen.getByText("default connect")).toBeTruthy();
  });
});
