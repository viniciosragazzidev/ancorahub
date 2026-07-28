import type { ConversationIdentity } from "../shared/types";

export interface WhatsAppWebAdapter {
  isReady(): boolean;
  getActiveConversation(): Promise<ConversationIdentity | null>;
  observeConversationChange(callback: () => void): () => void;
  insertComposerText(text: string): Promise<{ success: boolean; reason?: string }>;
}

const normalize = (value: string) => value.replace(/\D/g, "");
const phonePattern = /\+?\d[\d ()-]{7,}/;

function phoneFromReactState(element: Element | null) {
  if (!element) return undefined;
  const keys = Object.getOwnPropertyNames(element).filter((key) => key.startsWith("__reactFiber$") || key.startsWith("__reactProps$"));
  const visited = new WeakSet<object>();
  let inspected = 0;

  const visit = (value: unknown, key = "", depth = 0): string | undefined => {
    if (inspected >= 180 || depth > 5 || value == null) return undefined;
    if (typeof value === "string") {
      const isChatIdentifier = /@(c\.us|s\.whatsapp\.net)$/i.test(value);
      const isPhoneField = /(serialized|jid|phone|user)/i.test(key);
      const digits = normalize(value);
      return (isChatIdentifier || isPhoneField) && digits.length >= 8 ? `+${digits}` : undefined;
    }
    if (typeof value !== "object") return undefined;
    if (visited.has(value)) return undefined;
    visited.add(value);
    inspected += 1;
    for (const childKey of Object.keys(value).slice(0, 32)) {
      const phone = visit((value as Record<string, unknown>)[childKey], childKey, depth + 1);
      if (phone) return phone;
    }
    return undefined;
  };

  for (const key of keys) {
    const phone = visit((element as unknown as Record<string, unknown>)[key]);
    if (phone) return phone;
  }
  return undefined;
}

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

function phoneFromContactSidebar(displayName?: string) {
  const drawer = document.querySelector('[data-testid="drawer-right"]');
  const contactName = drawer?.querySelector<HTMLElement>('[data-testid="contact-info-subtitle"]')?.textContent?.trim();
  if (displayName && contactName && displayName.localeCompare(contactName, "pt-BR", { sensitivity: "base" }) !== 0) return undefined;
  return phoneFromElement(drawer);
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
      ?? phoneFromElement(document.querySelector('[data-testid="conversation-info-header"]'))
      ?? phoneFromContactSidebar(displayName)
      // WhatsApp's current header often renders only the contact name. This stays scoped
      // to the active header's React node and extracts only that chat identifier.
      ?? phoneFromReactState(header);
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
