// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { DefaultWhatsAppWebAdapter } from "../../../apps/browser-extension/src/content/whatsapp-adapter";

describe("DefaultWhatsAppWebAdapter", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("resolves the active chat phone from its scoped WhatsApp React state when the header has no visible number", async () => {
    document.body.innerHTML = `
      <main data-testid="wa-web-main-screen">
        <section data-testid="conversation-panel-wrapper">
          <header data-testid="conversation-header">
            <span data-testid="conversation-info-header-chat-title" title="Ana Lima">Ana Lima</span>
          </header>
        </section>
      </main>`;
    const header = document.querySelector('[data-testid="conversation-header"]') as HTMLElement;
    Object.defineProperty(header, "__reactFiber$test", {
      value: { memoizedProps: { chat: { id: { _serialized: "5521999999999@c.us" } } } },
    });

    await expect(new DefaultWhatsAppWebAdapter().getActiveConversation()).resolves.toMatchObject({
      displayName: "Ana Lima",
      phone: "+5521999999999",
    });
  });

  it("uses the visible contact detail sidebar as the preferred DOM fallback", async () => {
    document.body.innerHTML = `
      <main data-testid="wa-web-main-screen">
        <section data-testid="conversation-panel-wrapper"><header data-testid="conversation-header"><span data-testid="conversation-info-header-chat-title" title="Ana Lima" /></header></section>
        <aside data-testid="drawer-right"><span data-testid="contact-info-subtitle">Ana Lima</span><span>+55 21 99822-9404</span></aside>
      </main>`;

    await expect(new DefaultWhatsAppWebAdapter().getActiveConversation()).resolves.toMatchObject({
      phone: "+5521998229404",
    });
  });

  it("does not use a profile sidebar that belongs to a previously opened conversation", async () => {
    document.body.innerHTML = `
      <main data-testid="wa-web-main-screen">
        <section data-testid="conversation-panel-wrapper"><header data-testid="conversation-header"><span data-testid="conversation-info-header-chat-title" title="Beatriz" /></header></section>
        <aside data-testid="drawer-right"><span data-testid="contact-info-subtitle">Ana Lima</span><span>+55 21 99822-9404</span></aside>
      </main>`;

    await expect(new DefaultWhatsAppWebAdapter().getActiveConversation()).resolves.toMatchObject({
      displayName: "Beatriz",
      phone: undefined,
    });
  });
});
