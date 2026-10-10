// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mockDecide = vi.hoisted(() => vi.fn());
vi.mock("@/features/supervisor-workspace/transfer-actions", () => ({ decideBrokerTransferAction: mockDecide }));

import { TransferRequestsPanel } from "./transfer-requests-panel";

const request = {
  id: "request-1",
  brokerId: "broker-1",
  brokerName: "Ana Souza",
  fromSupervisorId: "supervisor-1",
  fromSupervisorName: "Caio Lima",
  toSupervisorId: "supervisor-2",
  toSupervisorName: "Bia Costa",
  branchId: "branch-1",
  branchName: "Centro",
  reason: "Equilibrar a cobertura de atendimento.",
  createdAt: "2026-10-10T12:00:00.000Z",
};

afterEach(() => cleanup());

describe("TransferRequestsPanel", () => {
  it("shows the transfer context and removes an approved request after success", async () => {
    mockDecide.mockResolvedValue({ ok: true });
    render(<TransferRequestsPanel requests={[request]} />);

    expect(screen.getByRole("heading", { name: "Pedidos de transferência" })).toBeTruthy();
    expect(screen.getByText(/Ana Souza.*Centro/)).toBeTruthy();
    expect(screen.getByText(request.reason)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Aprovar" }));

    await waitFor(() => expect(screen.getByText("Nenhum pedido aguardando decisão.")).toBeTruthy());
    expect(mockDecide).toHaveBeenCalledWith(request.id, true);
    expect(screen.getByRole("status").textContent).toBe("Transferência aprovada.");
  });

  it("keeps the pending request and shows the server error when rejecting fails", async () => {
    mockDecide.mockResolvedValue({ ok: false, reason: "Pedido fora da sua unidade." });
    render(<TransferRequestsPanel requests={[request]} />);
    fireEvent.click(screen.getByRole("button", { name: "Recusar" }));

    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Pedido fora da sua unidade."));
    expect(screen.getByText(request.reason)).toBeTruthy();
  });
});
