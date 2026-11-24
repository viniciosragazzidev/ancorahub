/**
 * The partnership ad's ready message: "Sou corretor(a) e quero conhecer a parceria da Âncora."
 * Accents, case, punctuation and small edits don't matter; it must still say that the person is
 * a broker and wants the partnership. Pure.
 */
function normalize(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function isBrokerPartnershipMessage(text: string | null | undefined): boolean {
  if (!text) return false;
  const value = normalize(text);
  if (value.length > 160) return false;
  return /\bsou corretor(?:a| a)?\b/.test(value) && /\bparceria\b/.test(value);
}
