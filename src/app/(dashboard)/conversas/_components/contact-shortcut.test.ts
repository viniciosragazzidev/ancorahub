import { describe, expect, it } from "vitest";

import { brokerDisplayName, contactShortcutMessage, isContactShortcut } from "./contact-shortcut";

describe("/contato shortcut", () => {
  it("is only the shortcut typed alone", () => {
    expect(isContactShortcut("/contato")).toBe(true);
    expect(isContactShortcut("  /Contato ")).toBe(true);
    expect(isContactShortcut("/contato amanhã")).toBe(false);
    expect(isContactShortcut("contato")).toBe(false);
  });

  it("writes the message with the broker's name", () => {
    expect(contactShortcutMessage(" Raiana Nunes ")).toBe("Nossa consultora Raiana Nunes entrará em contato para dar continuidade ao nosso atendimento.");
  });

  it("suggests the lead's broker without the internal code", () => {
    expect(brokerDisplayName("Alan Chile 4246")).toBe("Alan Chile");
    expect(brokerDisplayName("Não atribuído")).toBe("");
    expect(brokerDisplayName(null)).toBe("");
  });
});

describe("/contato name", () => {
  it("needs a readable name", async () => {
    const { isValidContactName } = await import("./contact-shortcut");
    expect(isValidContactName(".")).toBe(false);
    expect(isValidContactName(" - ")).toBe(false);
    expect(isValidContactName("Raiana")).toBe(true);
  });
});
