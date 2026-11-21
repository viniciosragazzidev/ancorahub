/**
 * Custo estimado por mensagem entregue (Meta Brasil, preço por mensagem de 2025, convertido a R$ 5,60): marketing
 * US$ 0,0625, utility US$ 0,0068, texto livre dentro da janela sem custo. WAHA não cobra por mensagem. É estimativa
 * para o painel (custo por recuperado), não fatura.
 */
export const META_COST_BRL = { marketing: 0.35, utility: 0.038, free: 0 } as const;

export function touchCostBrl(kind: keyof typeof META_COST_BRL, channel: "meta" | "waha" | "call" | null) {
  if (channel !== "meta") return 0;
  return META_COST_BRL[kind];
}
