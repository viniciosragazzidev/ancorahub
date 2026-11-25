/**
 * Histórico de observações do lead (25/11/2026, pedido do Vinicios): cada etapa registrada com observação
 * ("Entrei em contato", "Em negociação"...) vira um item, da mais nova para a mais antiga.
 *
 * A fonte é a linha do tempo (`lead_interactions`, tipo status_change). Desde 24/11 a observação vem limpa em
 * `metadata.observation`; antes disso, só no texto ("Observação: ..." ou "Como foi o contato: ...").
 */

export type LeadObservation = {
  id: string;
  observation: string;
  /** Etapa para onde o lead foi (status), quando conhecida. */
  toStatus: string | null;
  /** Rótulo da etapa lido do texto antigo, quando não há status. */
  stageText: string | null;
  authorName: string | null;
  createdAt: string;
};

const LEGACY_OBSERVATION = /(?:Observação|Como foi o contato):\s*([\s\S]+)$/;
const LEGACY_STAGE = /→\s*([^.]+)\./;

/** A observação de um item da linha do tempo, ou null quando ele não tem. */
export function observationFromInteraction(input: { conteudo: string; metadata: unknown }): { observation: string; toStatus: string | null; stageText: string | null } | null {
  const metadata = input.metadata && typeof input.metadata === "object" ? input.metadata as Record<string, unknown> : null;
  const saved = typeof metadata?.observation === "string" ? metadata.observation.trim() : "";
  if (saved) return { observation: saved, toStatus: typeof metadata?.toStatus === "string" ? metadata.toStatus : null, stageText: null };
  const legacy = input.conteudo.match(LEGACY_OBSERVATION)?.[1]?.trim();
  if (!legacy) return null;
  if (input.conteudo.startsWith("Novo contato registrado")) return { observation: legacy, toStatus: "contacted", stageText: null };
  return { observation: legacy, toStatus: null, stageText: input.conteudo.match(LEGACY_STAGE)?.[1]?.trim() ?? null };
}

/** Quantas observações a tela mostra no máximo. */
export const LEAD_OBSERVATIONS_LIMIT = 100;
