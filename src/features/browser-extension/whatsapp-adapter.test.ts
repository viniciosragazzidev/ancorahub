// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { DefaultWhatsAppWebAdapter } from "../../../apps/browser-extension/src/content/whatsapp-adapter";

describe("DefaultWhatsAppWebAdapter", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function prepararBuscaNovaConversa(numeroDoResultado = "+5511999990000", numeroAtivo = numeroDoResultado, rascunho = "", nomeDoResultado = "Contato de teste") {
    document.body.innerHTML = `
      <main data-testid="wa-web-main-screen">
        <button aria-label="Nova conversa" data-testid="new-chat">Novo chat</button>
        <input data-testid="chatlist-search" aria-label="Pesquisar nome ou número" />
        <section data-testid="conversation-panel-wrapper">
          <header data-testid="conversation-header"><span data-testid="conversation-info-header-chat-title" title="Contato de teste">Contato de teste</span></header>
          <footer><div data-testid="conversation-compose-box-input" contenteditable="true">${rascunho}</div></footer>
        </section>
      </main>`;
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockImplementation(() => ({ length: 1 } as DOMRectList));
    const campo = document.querySelector<HTMLInputElement>('[data-testid="chatlist-search"]')!;
    const header = document.querySelector<HTMLElement>('[data-testid="conversation-header"]')!;
    campo.addEventListener("input", () => {
      if (document.querySelector('[data-testid="cell-frame-container"]')) return;
      const resultado = document.createElement("div");
      resultado.dataset.testid = "cell-frame-container";
      resultado.setAttribute("role", "listitem");
      resultado.dataset.phone = numeroDoResultado;
      resultado.textContent = nomeDoResultado;
      resultado.addEventListener("click", () => header.dataset.phone = numeroAtivo);
      document.body.append(resultado);
    });
    const composer = document.querySelector<HTMLElement>('[data-testid="conversation-compose-box-input"]')!;
    const original = document.execCommand;
    const exec = vi.fn((_command: string, _showUI?: boolean, value?: string) => { composer.textContent = value ?? ""; return true; });
    Object.defineProperty(document, "execCommand", { configurable: true, value: exec });
    return { composer, exec, restore: () => {
      if (original) Object.defineProperty(document, "execCommand", { configurable: true, value: original });
      else Reflect.deleteProperty(document, "execCommand");
    } };
  }

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

  it("abre o chat novo, confirma o número exato e preenche a saudação sem enviar", async () => {
    const fixture = prepararBuscaNovaConversa();
    try {
      const result = await new DefaultWhatsAppWebAdapter().openNewConversation("+55 11 99999-0000", "Olá, contato de teste!");
      expect(result).toEqual({ success: true });
      expect(fixture.composer.textContent).toBe("Olá, contato de teste!");
      expect(fixture.exec).toHaveBeenCalledWith("insertText", false, "Olá, contato de teste!");
      expect(document.querySelector('[data-testid="send"]')).toBeNull();
    } finally { fixture.restore(); }
  });

  it("abre um contato não salvo quando o resultado mostra somente o número", async () => {
    const fixture = prepararBuscaNovaConversa("+5511999990000", "+5511999990000", "", "+55 11 99999-0000");
    try {
      const result = await new DefaultWhatsAppWebAdapter().openNewConversation("+5511999990000", "Olá, contato sem nome!");
      expect(result).toEqual({ success: true });
      expect(fixture.composer.textContent).toBe("Olá, contato sem nome!");
    } finally { fixture.restore(); }
  });

  it("não preenche se a conversa aberta não confirma o telefone buscado", async () => {
    vi.useFakeTimers();
    const fixture = prepararBuscaNovaConversa("+5511999990000", "+5511888880000");
    try {
      const pending = new DefaultWhatsAppWebAdapter().openNewConversation("+5511999990000", "Olá, contato de teste!");
      await vi.runAllTimersAsync();
      await expect(pending).resolves.toMatchObject({ success: false, reason: "IDENTITY_NOT_CONFIRMED" });
      expect(fixture.exec).not.toHaveBeenCalled();
    } finally { fixture.restore(); }
  });

  it("não sobrescreve rascunho existente no composer", async () => {
    const fixture = prepararBuscaNovaConversa("+5511999990000", "+5511999990000", "rascunho já digitado");
    try {
      await expect(new DefaultWhatsAppWebAdapter().openNewConversation("+5511999990000", "Olá, contato de teste!"))
        .resolves.toMatchObject({ success: false, reason: "COMPOSER_NOT_EMPTY" });
      expect(fixture.exec).not.toHaveBeenCalled();
      expect(fixture.composer.textContent).toBe("rascunho já digitado");
    } finally { fixture.restore(); }
  });
});
