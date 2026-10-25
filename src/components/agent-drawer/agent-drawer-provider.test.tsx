// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/auth/actions", () => ({
  getUserDisplayInfo: vi.fn(async () => ({ role: "director", permissions: [] })),
}));

import { AgentDrawerProvider, useAgentDrawer } from "./agent-drawer-provider";

function OpenState() {
  const { isOpen } = useAgentDrawer();
  return <span role="status">{isOpen ? "aberto" : "fechado"}</span>;
}

afterEach(() => cleanup());

describe("atalho do agente", () => {
  it("Ctrl+J abre o painel do Agente IA", async () => {
    render(<AgentDrawerProvider><OpenState /></AgentDrawerProvider>);
    fireEvent.keyDown(window, { key: "j", ctrlKey: true });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("aberto"));
  });
});
