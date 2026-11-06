/**
 * Funil profissional (05/11): onde o cliente para na qualificação, onde é perdido e quais campanhas trazem leads
 * melhores. Regras puras (a consulta fica em queries.ts). Plano: docs/implementations/active/2026-11-05-etapas-e-funil.md
 */

export const QUESTION_LABELS: Record<string, string> = {
  customerName: "Nome",
  planType: "Tipo de plano",
  numberOfLives: "Quantas pessoas",
  age: "Idades",
  city: "Cidade",
  neighborhood: "Bairro",
  email: "E-mail",
  currentPlan: "Plano atual",
};

export const STAGE_LABELS: Record<string, string> = {
  new: "Novo",
  distributed: "Distribuído",
  in_contact: "Em atendimento",
  quote_sent: "Cotação enviada",
  negotiation: "Negociação",
  documentation_pending: "Documentação",
  under_analysis: "Em análise",
  awaiting_reply: "Aguardando retorno",
  converted: "Venda",
  lost: "Perdido",
};

export type CountRow = { key: string; label: string; count: number; share: number };

/** Ordena do maior para o menor e calcula a fatia de cada um no total. */
export function rankCounts(counts: ReadonlyMap<string, number>, labels: Record<string, string>): CountRow[] {
  const total = [...counts.values()].reduce((sum, value) => sum + value, 0);
  return [...counts.entries()]
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({ key, label: labels[key] ?? key, count, share: total ? count / total : 0 }));
}

export type FunnelStep = { key: string; label: string; count: number };

/** A passagem entre duas etapas seguidas com a maior queda proporcional (ignora etapas com menos de 5 leads). */
export function biggestDrop(steps: readonly FunnelStep[]): { from: FunnelStep; to: FunnelStep; lostShare: number } | null {
  let best: { from: FunnelStep; to: FunnelStep; lostShare: number } | null = null;
  for (let index = 1; index < steps.length; index += 1) {
    const from = steps[index - 1];
    const to = steps[index];
    if (from.count < 5) continue;
    const lostShare = 1 - Math.min(to.count, from.count) / from.count;
    if (!best || lostShare > best.lostShare) best = { from, to, lostShare };
  }
  return best;
}

const pct = (value: number) => `${Math.round(value * 100)}%`;

/** A frase do topo: onde está a maior perda, dita de um jeito que dá para agir. */
export function headline(input: { drop: ReturnType<typeof biggestDrop>; topQuestion: CountRow | null; topLossStage: CountRow | null }): string | null {
  if (input.topQuestion && input.topQuestion.share >= 0.3 && input.drop && /Respond|Qualific/i.test(`${input.drop.from.label}${input.drop.to.label}`)) {
    return `Maior perda: ${pct(input.topQuestion.share)} dos que param na qualificação param na pergunta "${input.topQuestion.label}".`;
  }
  if (input.drop && input.drop.lostShare > 0) {
    return `Maior perda: ${pct(input.drop.lostShare)} dos leads não passam de "${input.drop.from.label}" para "${input.drop.to.label}".`;
  }
  if (input.topLossStage) return `Mais perdas na etapa "${input.topLossStage.label}" (${pct(input.topLossStage.share)} das perdas).`;
  return null;
}

export type CampaignRow = { key: string; name: string; leads: number; qualified: number; sales: number; qualifiedRate: number; saleRate: number };

export function campaignRow(input: { key: string; name: string | null; leads: number; qualified: number; sales: number }): CampaignRow {
  return {
    key: input.key,
    name: input.name?.trim() || (input.key === "_none" ? "Sem campanha" : input.key),
    leads: input.leads,
    qualified: input.qualified,
    sales: input.sales,
    qualifiedRate: input.leads ? input.qualified / input.leads : 0,
    saleRate: input.leads ? input.sales / input.leads : 0,
  };
}
