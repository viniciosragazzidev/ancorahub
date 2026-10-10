/**
 * Points rules of the broker journey: the code is the default, a tenant may
 * adjust points/caps/enabled in engagement_settings (R4).
 * Plan: docs/implementations/active/2026-10-10-central-relacionamento-corretor.md
 * (§3.1 and the Vigia rules in §8: points only with evidence, never a tap).
 */
import { z } from "zod";

export const ENGAGEMENT_RULE_KEYS = ["offer.fast_accept", "contact.first", "return.on_time", "note.service", "duty.presence", "sale.approved"] as const;
export type EngagementRuleKey = (typeof ENGAGEMENT_RULE_KEYS)[number];

export type EngagementRule = {
  key: EngagementRuleKey;
  label: string;
  /** How the broker earns it, shown on the journey screen. */
  hint: string;
  enabled: boolean;
  points: number;
  /** Max events of this rule per broker per day (America/Sao_Paulo); null = no cap. */
  dailyCap: number | null;
};

export const ENGAGEMENT_RULES: Record<EngagementRuleKey, EngagementRule> = {
  "offer.fast_accept": { key: "offer.fast_accept", label: "Aceite rápido", hint: "Aceitar a oferta do lead em até 1 minuto.", enabled: true, points: 3, dailyCap: null },
  "contact.first": { key: "contact.first", label: "Primeiro contato", hint: "Mandar a primeira mensagem ao cliente: até 5 min vale 15, até 15 min vale 10, dentro do prazo vale 5.", enabled: true, points: 15, dailyCap: null },
  "return.on_time": { key: "return.on_time", label: "Retorno em dia", hint: "Concluir o retorno agendado até o horário combinado.", enabled: true, points: 5, dailyCap: 10 },
  "note.service": { key: "note.service", label: "Atendimento registrado", hint: "Anotar como foi o atendimento, com detalhes.", enabled: true, points: 3, dailyCap: 10 },
  // Off until the legal opinion (plan §8.2: presence points may read as subordination).
  "duty.presence": { key: "duty.presence", label: "Presença no plantão", hint: "Confirmar a presença no plantão.", enabled: false, points: 10, dailyCap: 3 },
  // Off until sales have a management approval step (plan §8.1).
  "sale.approved": { key: "sale.approved", label: "Venda aprovada", hint: "Venda aprovada pela gestão.", enabled: false, points: 50, dailyCap: null },
};

/**
 * First contact tiers (seconds from assignment to the first message actually
 * sent). The "sla" tier uses the tenant SLA and only exists when it is longer
 * than 15 minutes.
 */
export const FIRST_CONTACT_TIERS = [
  { tier: "5min", maxSeconds: 5 * 60, points: 15 },
  { tier: "15min", maxSeconds: 15 * 60, points: 10 },
] as const;
export const FIRST_CONTACT_SLA_POINTS = 5;

export const FAST_ACCEPT_MAX_SECONDS = 60;
/** A return the broker scheduled for themself only scores when set at least this far ahead. */
export const RETURN_MIN_LEAD_HOURS = 2;
export const NOTE_MIN_LENGTH = 40;

const overrideSchema = z.object({
  enabled: z.boolean().optional(),
  points: z.number().int().min(0).max(500).optional(),
  dailyCap: z.number().int().min(1).max(100).nullable().optional(),
});
export const engagementOverridesSchema = z.partialRecord(z.enum(ENGAGEMENT_RULE_KEYS), overrideSchema);

/** The catalog with the tenant adjustments; an invalid override is ignored. */
export function resolveRules(overrides: unknown): Record<EngagementRuleKey, EngagementRule> {
  const parsed = engagementOverridesSchema.safeParse(overrides ?? {});
  const adjustments = parsed.success ? parsed.data : {};
  const rules = { ...ENGAGEMENT_RULES };
  for (const key of ENGAGEMENT_RULE_KEYS) {
    const adjustment = adjustments[key];
    if (adjustment) rules[key] = { ...rules[key], ...Object.fromEntries(Object.entries(adjustment).filter(([, value]) => value !== undefined)) };
  }
  return rules;
}
