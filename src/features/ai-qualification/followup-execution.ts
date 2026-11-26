/**
 * Quais regras de follow-up realmente disparam (regra pura, usada no servidor e na aba Follow-up).
 * Só a regra aprovada de reativação de lead frio executa. As outras ficam em preparação até serem aprovadas e
 * implementadas; quem traz de volta quem parou de responder hoje é a Recuperação (/qualificacao/recuperacao).
 */
export function isFollowUpExecutionAllowed(trigger: string, enabled: boolean) {
  return trigger === "cold_lead_reactivation" && enabled;
}

/** Selo da aba Follow-up: a regra está cadastrada, mas não dispara. */
export function followUpInertBadge(rule: { trigger: string; enabled: boolean }) {
  return isFollowUpExecutionAllowed(rule.trigger, rule.enabled) ? null : "Não dispara ainda";
}
