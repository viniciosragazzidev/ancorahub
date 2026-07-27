import type { ConversationIdentity } from "../shared/types";

export interface WhatsAppWebAdapter {
  isReady(): boolean;
  getActiveConversation(): Promise<ConversationIdentity | null>;
  observeConversationChange(callback: () => void): () => void;
  insertComposerText(text: string): Promise<{ success: boolean; reason?: string }>;
}

const normalize = (value: string) => value.replace(/\D/g, "");

export class DefaultWhatsAppWebAdapter implements WhatsAppWebAdapter {
  isReady() { return Boolean(document.querySelector("#app")); }
  async getActiveConversation() {
    const header = document.querySelector("header");
    if (!header) return null;
    const phone = header.querySelector("[title*='+'], [title*='55']")?.getAttribute("title") ?? header.textContent?.match(/\+?\d[\d ()-]{7,}/)?.[0];
    const displayName = header.querySelector("span[title]")?.getAttribute("title") ?? undefined;
    return { displayName, phone: phone ? `+${normalize(phone)}` : undefined, stableIdentifier: phone ? normalize(phone) : undefined };
  }
  observeConversationChange(callback: () => void) {
    const root = document.querySelector("#app") ?? document.body;
    let timer: number | undefined;
    const observer = new MutationObserver(() => { window.clearTimeout(timer); timer = window.setTimeout(callback, 400); });
    observer.observe(root, { subtree: true, childList: true });
    return () => { observer.disconnect(); window.clearTimeout(timer); };
  }
  async insertComposerText(text: string) {
    const composer = document.querySelector("[contenteditable='true'][data-tab], footer [contenteditable='true']") as HTMLElement | null;
    if (!composer) return { success: false, reason: "COMPOSER_NOT_FOUND" };
    composer.focus(); document.execCommand("insertText", false, text); composer.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
    return { success: true };
  }
}
