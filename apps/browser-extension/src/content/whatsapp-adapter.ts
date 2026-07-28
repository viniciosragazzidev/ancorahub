import type { ConversationIdentity } from "../shared/types";

export interface WhatsAppWebAdapter {
  isReady(): boolean;
  getActiveConversation(): Promise<ConversationIdentity | null>;
  observeConversationChange(callback: () => void): () => void;
  insertComposerText(text: string): Promise<{ success: boolean; reason?: string }>;
}

const normalize = (value: string) => value.replace(/\D/g, "");
const phonePattern = /\+?\d[\d ()-]{7,}/;

function phoneFromElement(element: Element | null) {
  if (!element) return undefined;
  const explicit = element.querySelector<HTMLElement>("[data-phone], [data-jid], a[href^='tel:']");
  const candidate = explicit?.getAttribute("data-phone")
    ?? explicit?.getAttribute("data-jid")
    ?? explicit?.getAttribute("href")?.replace(/^tel:/, "")
    ?? [...element.querySelectorAll<HTMLElement>("[title]")].map((item) => item.getAttribute("title") ?? "").find((value) => phonePattern.test(value))
    ?? element.textContent?.match(phonePattern)?.[0];
  const digits = candidate ? normalize(candidate) : "";
  return digits.length >= 8 ? `+${digits}` : undefined;
}

export class DefaultWhatsAppWebAdapter implements WhatsAppWebAdapter {
  isReady() { return Boolean(document.querySelector('[data-testid="wa-web-main-screen"]')); }
  async getActiveConversation() {
    const conversation = document.querySelector('[data-testid="conversation-panel-wrapper"]');
    const header = conversation?.querySelector('[data-testid="conversation-header"]');
    if (!conversation || !header) return null;
    const title = header.querySelector<HTMLElement>('[data-testid="conversation-info-header-chat-title"]');
    const displayName = title?.getAttribute("title") ?? title?.textContent?.trim() ?? undefined;
    // The number is only read when WhatsApp already exposes it in the conversation or
    // in the contact drawer opened by the user. The extension never clicks to reveal it.
    const phone = phoneFromElement(header)
      ?? phoneFromElement(document.querySelector('[data-testid="conversation-info-header"]'));
    return { displayName, phone, stableIdentifier: phone ? normalize(phone) : undefined };
  }
  observeConversationChange(callback: () => void) {
    const root = document.querySelector('[data-testid="wa-web-main-screen"]');
    if (!root) return () => undefined;
    let timer: number | undefined;
    const observer = new MutationObserver(() => { window.clearTimeout(timer); timer = window.setTimeout(callback, 400); });
    observer.observe(root, { subtree: true, childList: true });
    return () => { observer.disconnect(); window.clearTimeout(timer); };
  }
  async insertComposerText(text: string) {
    const composer = document.querySelector('[data-testid="conversation-compose-box-input"]') as HTMLElement | null;
    if (!composer) return { success: false, reason: "COMPOSER_NOT_FOUND" };
    composer.focus(); document.execCommand("insertText", false, text); composer.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
    return { success: true };
  }
}
