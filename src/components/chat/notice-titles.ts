/**
 * Títulos do aviso de lead novo (docs/design-system/FEEDBACK.md §8): o mesmo evento tem algumas
 * frases e nunca repete a última mostrada. Só troca o título genérico; um título com informação do
 * servidor (nome do lead, origem) fica como veio.
 */
export const GENERIC_LEAD_TITLES = ["Novo lead recebido", "Lead novo", ""] as const;

export const LEAD_NOTICE_TITLES = [
  "Lead novo para você",
  "Chegou um lead",
  "Tem lead esperando você",
  "Lead novo na sua fila",
  "Um cliente quer falar com você",
] as const;

export function isGenericLeadTitle(title: string | null | undefined) {
  return (GENERIC_LEAD_TITLES as readonly string[]).includes((title ?? "").trim());
}

/** Próximo título: sorteia entre os que não são o último. `random` entra para teste. */
export function nextLeadNoticeTitle(last: string | null, random: () => number = Math.random) {
  const options = LEAD_NOTICE_TITLES.filter((title) => title !== last);
  return options[Math.min(options.length - 1, Math.floor(random() * options.length))];
}

let lastShown: string | null = null;
const byNotice = new Map<string, string>();

/** Título estável por aviso: o mesmo id sempre devolve a mesma frase. */
export function leadNoticeTitle(id: string, serverTitle: string | null | undefined) {
  if (!isGenericLeadTitle(serverTitle)) return serverTitle as string;
  const known = byNotice.get(id);
  if (known) return known;
  const title = nextLeadNoticeTitle(lastShown);
  lastShown = title;
  byNotice.set(id, title);
  if (byNotice.size > 50) byNotice.delete(byNotice.keys().next().value as string);
  return title;
}
