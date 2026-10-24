// @vitest-environment jsdom
import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LiteNumber } from "./number";

// Hidratação com o motion real (o setup global troca por um mock de texto).
vi.unmock("motion/react");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("LiteNumber hidratação", () => {
  it("hidrata o HTML do servidor sem erro e mantém o valor final", async () => {
    const element = <LiteNumber value={1234} countFromZero live />;
    const html = renderToString(element);
    expect(html).toContain("1.234");

    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);

    await act(async () => {
      hydrateRoot(container, element);
    });

    expect(errors).not.toHaveBeenCalled();
    expect(container.querySelector(".sr-only")?.textContent?.replace(/ /g, " ")).toBe("1.234");
  });
});
