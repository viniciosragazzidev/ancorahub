import { createHash } from "node:crypto";

import type { AutoRuleKey } from "./auto-rules";

/* ─── Identidade (idempotência) ─── */

/** Uma campanha automática por empresa, regra e dia de envio. Sem ":" (a chave do outbox é `post-sale:<campanha>:<lead>`). */
export function autoRuleCampaignId(tenantId: string, key: AutoRuleKey, sendDay: string) {
  return `post-sale-${key.toLowerCase()}-${createHash("sha256").update(`${tenantId}|${key}|${sendDay}`).digest("hex").slice(0, 24)}`;
}

/** Um survey por lead, regra e marco: rodar o motor duas vezes (ou em dias seguidos) não cria outro. */
export function autoRuleSurveyId(tenantId: string, leadId: string, key: AutoRuleKey, milestoneAt: Date) {
  return `post-sale-${key.toLowerCase()}-${createHash("sha256").update(`${tenantId}|${leadId}|${key}|${milestoneAt.toISOString()}`).digest("hex").slice(0, 32)}`;
}
