/**
 * Regras puras da lista da central de conversas: quem está sem dono e como descrever os filtros ativos
 * no estado vazio ("Nenhuma conversa com esses filtros").
 */

/** Sem dono: conversa sem corretor responsável (inclui contato avulso, que ainda não virou lead). */
export function isUnownedConversation(conversation: { corretorId: string | null }) {
  return !conversation.corretorId;
}

export type ActiveConversationFilters = {
  query?: string;
  branchName?: string | null;
  tagName?: string | null;
  /** Rótulo da situação escolhida; vazio quando é "Todos". */
  situationLabel?: string | null;
};

/** Lista curta do que está filtrando a lista agora, na ordem em que aparece na tela. */
export function describeActiveConversationFilters(filters: ActiveConversationFilters): string[] {
  const parts: string[] = [];
  const query = filters.query?.trim();
  if (query) parts.push(`Busca: ${query}`);
  if (filters.branchName) parts.push(`Unidade: ${filters.branchName}`);
  if (filters.tagName) parts.push(`Tag: ${filters.tagName}`);
  if (filters.situationLabel) parts.push(`Situação: ${filters.situationLabel}`);
  return parts;
}
