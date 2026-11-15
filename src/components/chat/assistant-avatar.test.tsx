// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ContextualIllustration, ContextualIllustrationsProvider } from "@/components/illustrations/contextual-illustration";
import { AssistantAvatar } from "./assistant-avatar";

afterEach(cleanup);

function avatar(enabled: boolean) {
  return (
    <ContextualIllustrationsProvider enabled={enabled}>
      <AssistantAvatar shape="cubo" hue={150} avatarAsset="agenda" state="waiting" />
    </ContextualIllustrationsProvider>
  );
}

describe("assistant area avatar", () => {
  it("uses a decorative contextual image when the visual control is enabled", () => {
    const { container } = render(avatar(true));
    const image = container.querySelector("img");
    expect(image?.getAttribute("src")?.endsWith("/assistant-areas/agenda.webp")).toBe(true);
    expect(image?.getAttribute("alt")).toBe("");
    expect(image?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector("svg")).toBeNull();
  });

  it("restores the existing abstract avatar when the control is disabled or an asset fails", () => {
    const { container, rerender } = render(avatar(false));
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();

    rerender(avatar(true));
    const image = container.querySelector("img");
    if (!image) throw new Error("Expected contextual avatar image");
    fireEvent.error(image);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("can enable team avatars without widening existing section illustrations", () => {
    const { container } = render(
      <ContextualIllustrationsProvider enabled={false} assistantAvatarsEnabled>
        <AssistantAvatar shape="cubo" hue={150} avatarAsset="equipe" />
        <ContextualIllustration name="calendar" fallback={<span>Ícone anterior</span>} />
      </ContextualIllustrationsProvider>,
    );
    expect([...container.querySelectorAll("img")].some((image) => image.getAttribute("src")?.endsWith("/assistant-areas/equipe.webp"))).toBe(true);
    expect([...container.querySelectorAll("img")].some((image) => image.getAttribute("src")?.endsWith("/illustrations/ancora/calendar.webp"))).toBe(false);
    expect(container.querySelector("svg")).toBeNull();
  });
});
