// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// The badge owns the QR pairing and polling (server actions); it is covered by its own flow.
vi.mock("@/features/broker-workspace/components/connection-badge", () => ({
  ConnectionBadge: ({ connected, status }: { connected: boolean; status: string }) => (
    <p data-testid="connection">{connected ? "conectado" : `desconectado:${status}`}</p>
  ),
}));

import { isLightRouteAllowed, resolveLightRoute } from "@/components/light/light-routes";

import { LightWhatsappSection } from "./light-whatsapp-section";

afterEach(() => cleanup());

describe("LightWhatsappSection", () => {
  it("shows the broker own connection state from the server", () => {
    const { unmount } = render(<LightWhatsappSection connected status="ready" />);
    expect(screen.getByTestId("connection").textContent).toBe("conectado");
    expect(screen.getByRole("heading", { name: "WhatsApp pessoal de atendimento" })).toBeTruthy();
    unmount();

    render(<LightWhatsappSection connected={false} status="disconnected" />);
    expect(screen.getByTestId("connection").textContent).toBe("desconectado:disconnected");
  });

  it("does not open the corporate integrations page to the Light broker", () => {
    expect(isLightRouteAllowed("/integrations/whatsapp")).toBe(false);
    expect(isLightRouteAllowed("/integrations")).toBe(false);
    expect(resolveLightRoute("/settings", new URLSearchParams("tab=whatsapp"))).toMatchObject({
      title: "WhatsApp", parentHref: "/settings", backToParent: true,
    });
  });
});
