// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-media-query", () => ({ useMediaQuery: () => false }));

import { LeadSocialLayout } from "./lead-social-layout";

afterEach(() => cleanup());

describe("LeadSocialLayout", () => {
  it("removes the Client data modal when its action opens the sale flow, without reopening it afterward", async () => {
    const props = { header: <p>Cliente Demo</p>, next: null, details: <p>Dados completos</p>, conversation: <p>Conversa</p> };
    const { rerender } = render(<LeadSocialLayout {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Ver dados do cliente" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    rerender(<LeadSocialLayout {...props} detailOverlayActive />);
    expect(screen.queryByRole("dialog")).toBeNull();
    rerender(<LeadSocialLayout {...props} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Ver dados do cliente" })).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Ver dados do cliente" })));
  });
  it("keeps the client data sheet in the Lite theme after portaling outside the page", () => {
    render(<LeadSocialLayout header={<p>Cliente</p>} next={null} details={<p>Dados completos</p>} conversation={<p>Conversa</p>} />);
    fireEvent.click(screen.getByRole("button", { name: "Ver dados do cliente" }));
    expect(screen.getByRole("dialog")).toHaveClass("arc-venancor");
    expect(screen.getByRole("button", { name: "Fechar dados do cliente" })).toBeTruthy();
  });

  it("keeps the conversation in the main area and reveals the next step and full data through the eye", () => {
    render(
      <LeadSocialLayout
        header={<p>Cabeçalho da Maria</p>}
        next={<p>Responder o cliente</p>}
        details={<p>Dados completos</p>}
        conversation={<p>Conversa com a Maria</p>}
      />,
    );

    expect(screen.getByText("Cabeçalho da Maria")).toBeTruthy();
    expect(screen.queryByText("Responder o cliente")).toBeNull();
    expect(screen.getByText("Conversa com a Maria")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ver dados do cliente" }));
    expect(screen.getByText("Responder o cliente")).toBeTruthy();
  });
});
