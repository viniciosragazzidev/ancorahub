/**
 * Ações da ficha do cliente para o corretor Lite (C2). Regra pura, sem I/O.
 * Documentos, links de conversa e de venda só aparecem enquanto o cliente é da carteira do corretor. Se o lead
 * saiu da carteira (transferência) ou o estado de dono é desconhecido (falha), a ficha fica só de leitura.
 */
export type FichaAcoesCorretor = { documents: boolean; conversation: boolean; saleLinks: boolean };

export function fichaAcoesCorretor(input: {
  walletOn: boolean;
  nextState: string | null | undefined;
  canConversas: boolean;
}): FichaAcoesCorretor | null {
  // Flag desligada: a ficha segue como antes (nenhuma regra da carteira se aplica).
  if (!input.walletOn) return null;
  // Estado de dono desconhecido ou transferido: nada de ações.
  if (!input.nextState || input.nextState === "not_owner") return { documents: false, conversation: false, saleLinks: false };
  return { documents: true, conversation: input.canConversas, saleLinks: true };
}
