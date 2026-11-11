/** Quem configura a captura da campanha também escreve o plano anunciado (mesma regra da tela da campanha). */
export function canEditCampaignBrokerOffer(context: { role: string; jobTitle?: string | null }) {
  return context.role === "director" || context.role === "manager" || context.jobTitle === "marketing";
}
