// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ContextualIllustration, ContextualIllustrationsProvider } from "./contextual-illustration";

afterEach(cleanup);

describe("contextual illustration fallback", () => {
  it("keeps the existing presentation outside the governed visual scope", () => {
    const { container } = render(<ContextualIllustration name="calendar" fallback={<span>Ícone anterior</span>} />);
    expect(screen.getByText("Ícone anterior")).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
  });

  it("removes images immediately when the control is disabled", () => {
    const view = (enabled: boolean) => <ContextualIllustrationsProvider enabled={enabled}><ContextualIllustration name="calendar" fallback={<span>Ícone anterior</span>} /></ContextualIllustrationsProvider>;
    const { container, rerender } = render(view(true));
    expect(container.querySelector("img")?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector("img")?.getAttribute("alt")).toBe("");
    rerender(view(false));
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("Ícone anterior")).toBeTruthy();
  });

  it("preserves the original icon when a file fails to load", () => {
    const { container } = render(<ContextualIllustrationsProvider enabled><ContextualIllustration name="conversation" fallback={<span>Ícone de conversa</span>} /></ContextualIllustrationsProvider>);
    const image = container.querySelector("img");
    if (!image) throw new Error("Expected illustration");
    fireEvent.error(image);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("Ícone de conversa")).toBeTruthy();
  });
});
