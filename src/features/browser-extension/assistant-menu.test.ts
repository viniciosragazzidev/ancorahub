// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { mountPanel } from "../../../apps/browser-extension/src/content/panel-mount";

describe("AncoraHub Assistant compose menu", () => {
  afterEach(() => { document.body.innerHTML = ""; });

  it("mounts beside WhatsApp's attach control only after an authorized lead is resolved", () => {
    document.body.innerHTML = `<div data-testid="compose-box"><span><button aria-label="Anexar"></button></span></div>`;
    const menu = mountPanel(() => undefined, async () => [], async () => undefined);

    expect(document.querySelector("#ancorahub-assistant-menu")).toBeTruthy();
    expect(document.querySelector<HTMLElement>("#ancorahub-assistant-menu")?.hidden).toBe(true);

    menu?.renderLead({
      status: "FOUND",
      lead: { id: "lead-12345678", version: 1, name: "Lead de teste", currentStatus: { label: "Novo" } },
    });

    expect(document.querySelector<HTMLElement>("#ancorahub-assistant-menu")?.hidden).toBe(false);
  });
});
