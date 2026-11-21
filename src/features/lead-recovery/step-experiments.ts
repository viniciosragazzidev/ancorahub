/**
 * Teste A/B por passo (plano §9, fase 5). Um teste por vez: hoje, o S2 com pergunta fechada (o campo que falta) ×
 * aberta ("o que falta pra gente fechar?"). Reaproveita o Thompson sampling da 1ª mensagem (`assignVariant`):
 * divisão estável 50/50 até 50 envios por variante, depois favorece a que mais recebe resposta em 24 h, seguindo
 * com 10% de exploração. Desligado (padrão), todo mundo recebe a fechada.
 */
import { assignVariant, type VariantStats } from "@/features/qualification-turbo/experiments";

import { SAIR_FOOTER } from "./cadence-rules";
import type { RecoveryStepId } from "./settings-core";

export const STEP_VARIANTS: Partial<Record<RecoveryStepId, readonly string[]>> = {
  s2: ["fechada", "aberta"],
};

export function chooseStepVariant(input: { leadId: string; step: RecoveryStepId; enabled: boolean; stats: readonly VariantStats[] }) {
  const variants = STEP_VARIANTS[input.step];
  if (!variants?.length) return null;
  if (!input.enabled) return variants[0]!;
  return assignVariant({ leadId: input.leadId, experiment: `recovery:${input.step}`, variants, stats: input.stats, learn: true });
}

/** Texto da variante; a "fechada" é o texto padrão do passo. */
export function stepVariantText(step: RecoveryStepId, variant: string | null, fallback: string, leadName: string | null) {
  if (step !== "s2" || variant !== "aberta") return fallback;
  const first = (leadName ?? "").trim().split(/\s+/)[0] ?? "";
  const name = /^[\p{L}]{2,20}$/u.test(first) ? first.charAt(0).toLocaleUpperCase("pt-BR") + first.slice(1).toLocaleLowerCase("pt-BR") : null;
  return `${name ? `Oi, ${name}!` : "Oi!"} Me conta: o que falta pra gente fechar a sua cotação de plano de saúde?\n\n${SAIR_FOOTER}`;
}
