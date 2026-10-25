import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./director-chrome.css", import.meta.url), "utf8");

describe("escopo raiz do chrome do diretor", () => {
  it("aplica regras aos portais e estados que também são a raiz Arc", () => {
    for (const className of [
      "director-dashboard-header",
      "director-route-state",
      "director-route-loading",
      "director-command-palette",
      "director-agent-drawer",
      "director-feedback-drawer",
      "director-pwa-prompt",
    ]) {
      expect(css).toContain(`.arc-venancor[data-skin="diretor"].${className}`);
    }
  });
});
