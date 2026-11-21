/**
 * Exceção da DEC-155 para a recuperação (DEC-190, 21/11/2026). A regra continua: a qualificação, os lembretes e a
 * requalificação usam só template Utility. A exceção vale SÓ para estes passos de recuperação, que são Marketing por
 * natureza (reengajamento): T2–T4 do turbo, S4–S6 da cadência única e a nutrição. E só com a recuperação ligada e
 * a conferência jurídica registrada (os mesmos interruptores que já seguram a cadência).
 */
import type { RecoverySettings } from "./settings-core";

export const RECOVERY_MARKETING_TEMPLATES: ReadonlySet<string> = new Set([
  "anc_t2_beneficio",
  "anc_t3_ligacao",
  "anc_t4_despedida",
  "anc_s4_cotacao",
  "anc_s5_ligacao",
  "anc_s6_despedida",
  "anc_n_reajuste",
]);

/** A exceção vale para esta empresa agora? */
export function recoveryMarketingAllowed(settings: Pick<RecoverySettings, "enabled" | "legalReviewedAt"> | null | undefined) {
  return Boolean(settings?.enabled && settings.legalReviewedAt);
}

/** O template pode sair como Marketing pela exceção? (nome na lista, categoria Marketing, exceção ligada) */
export function isRecoveryMarketingTemplate(name: string, category: string | null | undefined, allowed: boolean) {
  return allowed && RECOVERY_MARKETING_TEMPLATES.has(name) && (category ?? "").toUpperCase() === "MARKETING";
}

/**
 * Templates que um passo de recuperação pode usar: os Utility aprovados e, com a exceção ligada, os Marketing
 * aprovados que estão na lista. Qualquer outro Marketing continua de fora.
 */
export function recoveryUsableTemplates(input: { utility: ReadonlySet<string>; marketing: ReadonlySet<string>; allowed: boolean }) {
  const usable = new Set(input.utility);
  if (input.allowed) for (const name of input.marketing) if (RECOVERY_MARKETING_TEMPLATES.has(name)) usable.add(name);
  return usable;
}
