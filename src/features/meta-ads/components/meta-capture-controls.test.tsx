// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { refreshMock, setGlobalModeMock } = vi.hoisted(() => ({
  refreshMock: vi.fn(),
  setGlobalModeMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock }) }));
vi.mock("@/components/ui/sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../actions", () => ({ setMetaGlobalCaptureModeAction: setGlobalModeMock }));

import { MetaMasterCaptureControl } from "./meta-capture-controls";

afterEach(() => {
  cleanup();
  refreshMock.mockClear();
  setGlobalModeMock.mockReset();
});

describe("MetaMasterCaptureControl", () => {
  it("updates the global safety mode and refreshes the route tree", async () => {
    setGlobalModeMock.mockResolvedValue({ success: true });
    render(<MetaMasterCaptureControl canConfigure globalMode="all" />);

    fireEvent.click(screen.getByLabelText("Segurança global da captura Meta"));
    fireEvent.click(screen.getByRole("option", { name: /Liberar campanhas configuradas/i }));

    await waitFor(() => expect(setGlobalModeMock).toHaveBeenCalledWith({ mode: "selective" }));
    expect(await screen.findByText(/Controle global atualizado/i)).toBeInTheDocument();
    expect(refreshMock).toHaveBeenCalled();
  });
});
