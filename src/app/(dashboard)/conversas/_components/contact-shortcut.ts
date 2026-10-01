/** Message shortcut typed in the chat: "/contato" tells the customer which broker will call. */
export const CONTACT_SHORTCUT = "/contato";

export function isContactShortcut(text: string) {
  return text.trim().toLowerCase() === CONTACT_SHORTCUT;
}

export function contactShortcutMessage(brokerName: string) {
  return `Nossa consultora ${brokerName.trim()} entrará em contato para dar continuidade ao nosso atendimento.`;
}

/** The lead's broker as the customer should read it: no internal code ("Alan Chile 4246" → "Alan Chile"). */
export function brokerDisplayName(name: string | null | undefined) {
  const clean = name?.replace(/\s+\d+$/, "").trim() ?? "";
  return clean && !/^n[ãa]o atribu[íi]do$/i.test(clean) ? clean : "";
}
