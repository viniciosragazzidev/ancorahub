import type { ConversationIdentity } from "../shared/types";
import { focarSemRolar } from "./rolagem";

export interface WhatsAppWebAdapter {
  isReady(): boolean;
  getActiveConversation(): Promise<ConversationIdentity | null>;
  observeConversationChange(callback: () => void): () => void;
  insertComposerText(text: string): Promise<{ success: boolean; reason?: string }>;
  openNewConversation(phone: string, greeting: string): Promise<{ success: boolean; reason?: string }>;
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
  const candidate = element.getAttribute("data-phone")
    ?? element.getAttribute("data-jid")
    ?? explicit?.getAttribute("data-phone")
    ?? explicit?.getAttribute("data-jid")
    ?? explicit?.getAttribute("href")?.replace(/^tel:/, "")
    ?? [...element.querySelectorAll<HTMLElement>("[title]")].map((item) => item.getAttribute("title") ?? "").find((value) => phonePattern.test(value))
    ?? element.textContent?.match(phonePattern)?.[0];
  const digits = candidate ? normalize(candidate) : "";
  return digits.length >= 8 ? `+${digits}` : undefined;
}

function visivel(elemento: Element): elemento is HTMLElement {
  return elemento instanceof HTMLElement && elemento.getClientRects().length > 0 && getComputedStyle(elemento).visibility !== "hidden";
}

function acharBotaoNovaConversa() {
  const seletores = [
    'button[aria-label="Nova conversa"]', 'button[aria-label="Novo chat"]',
    'button[aria-label="New chat"]', 'button[title="Nova conversa"]', 'button[title="New chat"]',
    '[data-testid="new-chat"]', '[data-testid="chat-list-header"] button',
  ];
  for (const seletor of seletores) {
    const alvos = [...document.querySelectorAll(seletor)].filter(visivel);
    if (alvos.length === 1) return alvos[0];
    if (alvos.length > 1) return null;
  }
  const icones = [...document.querySelectorAll<HTMLElement>('[data-icon="new-chat-outline"], [data-icon="new-chat"]')]
    .map((element) => element.closest<HTMLElement>('button,[role="button"]'))
    .filter((element): element is HTMLElement => element !== null && visivel(element));
  const unicos = [...new Set(icones)];
  return unicos.length === 1 ? unicos[0] : null;
}

function acharCampoBuscaNovoChat() {
  const seletores = [
    '[data-testid="chatlist-search"] input', 'input[data-testid="chatlist-search"]',
    '[data-testid="new-chat-search"]',
    'input[aria-label="Pesquisar nome ou número"]', 'input[aria-label="Search name or number"]',
    'input[placeholder="Pesquisar nome ou número"]', 'input[placeholder="Search name or number"]',
  ];
  for (const seletor of seletores) {
    const alvos = [...document.querySelectorAll(seletor)].filter(visivel);
    if (alvos.length === 1) return alvos[0];
    if (alvos.length > 1) return null;
  }
  return null;
}

function escreverBusca(campo: HTMLElement, texto: string) {
  focarSemRolar(campo);
  if (campo instanceof HTMLInputElement) {
    campo.value = texto;
    campo.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: texto }));
    campo.dispatchEvent(new Event("change", { bubbles: true }));
    return;
  }
  // Campo editável do WhatsApp (editor próprio): escrever pelo execCommand, como um digitar de verdade.
  // textContent + InputEvent sintético não passa pelo editor e pode duplicar ou não buscar.
  document.execCommand("selectAll", false);
  document.execCommand("insertText", false, texto);
}

function resultadosPorTelefone(phone: string) {
  const rows = [...document.querySelectorAll<HTMLElement>('[data-testid="cell-frame-container"], [role="listitem"], [role="option"]')].filter(visivel);
  const correspondencias = rows.filter((row) => {
    const visivelPhone = phoneFromElement(row)?.replace(/\D/g, "");
    const textDigits = normalize(`${row.textContent ?? ""} ${row.getAttribute("aria-label") ?? ""} ${row.getAttribute("title") ?? ""}`);
    return visivelPhone === phone || textDigits.includes(phone);
  });
  return [...new Set(correspondencias)];
}

function esperar<T>(encontrar: () => T | null, tentativas = 24): Promise<T | null> {
  return new Promise((resolve) => {
    let restantes = tentativas;
    const procurar = () => {
      const encontrado = encontrar();
      if (encontrado || restantes <= 0) { resolve(encontrado); return; }
      restantes -= 1;
      window.setTimeout(procurar, 250);
    };
    procurar();
  });
}

async function esperarAsync<T>(encontrar: () => Promise<T | null>, tentativas = 24): Promise<T | null> {
  for (let tentativa = 0; tentativa < tentativas; tentativa += 1) {
    const encontrado = await encontrar();
    if (encontrado) return encontrado;
    await new Promise((resolve) => window.setTimeout(resolve, 250));
  }
  return null;
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
    // Só o execCommand: ele já dispara o input nativo. Um InputEvent extra fazia o editor do WhatsApp
    // inserir o texto de novo (texto duplicado no piloto de 03/11).
    focarSemRolar(composer); document.execCommand("insertText", false, text);
    return { success: true };
  }

  async openNewConversation(phone: string, greeting: string) {
    const digits = normalize(phone);
    if (digits.length < 8 || !greeting.trim()) return { success: false, reason: "INVALID_ACCEPTED_LEAD" };
    const novoChat = acharBotaoNovaConversa();
    if (!novoChat) return { success: false, reason: "NEW_CHAT_NOT_FOUND" };
    novoChat.click();
    const campo = await esperar(acharCampoBuscaNovoChat);
    if (!campo) return { success: false, reason: "SEARCH_NOT_FOUND" };
    escreverBusca(campo, digits);
    const resultado = await esperar(() => {
      const rows = resultadosPorTelefone(digits);
      return rows.length === 1 ? rows[0] : null;
    });
    if (!resultado) return { success: false, reason: "PHONE_RESULT_NOT_UNIQUE" };
    resultado.click();
    const conversa = await esperarAsync(async () => {
      const atual = await this.getActiveConversation();
      return atual?.phone && normalize(atual.phone) === digits ? true : null;
    });
    if (!conversa) return { success: false, reason: "IDENTITY_NOT_CONFIRMED" };
    const composer = document.querySelector<HTMLElement>('[data-testid="conversation-compose-box-input"]');
    if (!composer) return { success: false, reason: "COMPOSER_NOT_FOUND" };
    if ((composer.innerText ?? composer.textContent ?? "").trim()) return { success: false, reason: "COMPOSER_NOT_EMPTY" };
    return this.insertComposerText(greeting);
  }
}
