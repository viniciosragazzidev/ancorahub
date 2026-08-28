import "server-only";

import { eq, asc } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";

export type RoutingRuleConditions = {
  planTypes?: string[];
  sources?: string[];
  cities?: string[];
  minLives?: number;
  maxLives?: number;
  qualificationStatuses?: string[];
};

export type TargetType = "queue" | "branch" | "broker_group" | "specific_broker";

export type LeadRoutingInput = {
  planType?: string | null;
  source?: string | null;
  city?: string | null;
  lives?: number | null;
  qualificationStatus?: string | null;
  branchId?: string | null;
};

export type RoutingRule = {
  id: string;
  tenantId: string;
  name: string;
  priority: number;
  enabled: boolean;
  conditions: RoutingRuleConditions;
  targetType: TargetType;
  targetId: string;
  fallbackQueueId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function fetchRoutingRules(tenantId: string): Promise<RoutingRule[]> {
  const db = getDatabase();
  const rows = await db
    .select()
    .from(schema.leadRoutingRules)
    .where(eq(schema.leadRoutingRules.tenantId, tenantId))
    .orderBy(asc(schema.leadRoutingRules.priority));

  return rows as RoutingRule[];
}

export function evaluateLeadAgainstConditions(
  conditions: RoutingRuleConditions,
  lead: LeadRoutingInput,
): { matches: boolean; reasons: string[] } {
  const reasons: string[] = [];
  let matches = true;

  // 1. Tipo de Plano
  if (conditions.planTypes && conditions.planTypes.length > 0) {
    const leadPlan = (lead.planType ?? "").trim().toLowerCase();
    const hasMatch = conditions.planTypes.some((p) => p.trim().toLowerCase() === leadPlan);
    if (!hasMatch) {
      matches = false;
      reasons.push(`Plano '${lead.planType ?? "N/A"}' não está em [${conditions.planTypes.join(", ")}]`);
    } else {
      reasons.push(`Plano '${lead.planType}' atende à condição`);
    }
  }

  // 2. Origem / Canal
  if (conditions.sources && conditions.sources.length > 0) {
    const leadSource = (lead.source ?? "").trim().toLowerCase();
    const hasMatch = conditions.sources.some((s) => s.trim().toLowerCase() === leadSource || leadSource.includes(s.trim().toLowerCase()));
    if (!hasMatch) {
      matches = false;
      reasons.push(`Origem '${lead.source ?? "N/A"}' não está em [${conditions.sources.join(", ")}]`);
    } else {
      reasons.push(`Origem '${lead.source}' atende à condição`);
    }
  }

  // 3. Cidade / Localização
  if (conditions.cities && conditions.cities.length > 0) {
    const leadCity = (lead.city ?? "").trim().toLowerCase();
    const hasMatch = conditions.cities.some((c) => c.trim().toLowerCase() === leadCity || leadCity.includes(c.trim().toLowerCase()));
    if (!hasMatch) {
      matches = false;
      reasons.push(`Cidade '${lead.city ?? "N/A"}' não está em [${conditions.cities.join(", ")}]`);
    } else {
      reasons.push(`Cidade '${lead.city}' atende à condição`);
    }
  }

  // 4. Quantidade de Vidas (Min)
  if (typeof conditions.minLives === "number" && conditions.minLives > 0) {
    const lives = lead.lives ?? 1;
    if (lives < conditions.minLives) {
      matches = false;
      reasons.push(`Vidas (${lives}) abaixo do mínimo (${conditions.minLives})`);
    } else {
      reasons.push(`Vidas (${lives}) atende ao mínimo (${conditions.minLives})`);
    }
  }

  // 5. Quantidade de Vidas (Max)
  if (typeof conditions.maxLives === "number" && conditions.maxLives > 0) {
    const lives = lead.lives ?? 1;
    if (lives > conditions.maxLives) {
      matches = false;
      reasons.push(`Vidas (${lives}) excede o máximo (${conditions.maxLives})`);
    } else {
      reasons.push(`Vidas (${lives}) atende ao máximo (${conditions.maxLives})`);
    }
  }

  // 6. Status de Qualificação por IA
  if (conditions.qualificationStatuses && conditions.qualificationStatuses.length > 0) {
    const leadStatus = (lead.qualificationStatus ?? "unqualified").trim().toLowerCase();
    const hasMatch = conditions.qualificationStatuses.some((st) => st.trim().toLowerCase() === leadStatus);
    if (!hasMatch) {
      matches = false;
      reasons.push(`Status de IA '${lead.qualificationStatus ?? "N/A"}' não corresponde`);
    } else {
      reasons.push(`Status de IA '${lead.qualificationStatus}' atende à condição`);
    }
  }

  return { matches, reasons };
}

export async function resolveLeadDestinationRule(
  tenantId: string,
  lead: LeadRoutingInput,
): Promise<{
  matchedRule: RoutingRule | null;
  evaluations: Array<{ ruleId: string; ruleName: string; matches: boolean; reasons: string[] }>;
}> {
  const rules = await fetchRoutingRules(tenantId);
  const activeRules = rules.filter((r) => r.enabled);

  const evaluations: Array<{ ruleId: string; ruleName: string; matches: boolean; reasons: string[] }> = [];
  let matchedRule: RoutingRule | null = null;

  for (const rule of activeRules) {
    const result = evaluateLeadAgainstConditions(rule.conditions, lead);
    evaluations.push({
      ruleId: rule.id,
      ruleName: rule.name,
      matches: result.matches,
      reasons: result.reasons,
    });

    if (result.matches && !matchedRule) {
      matchedRule = rule;
    }
  }

  return { matchedRule, evaluations };
}

export async function simulateLeadRouting(tenantId: string, lead: LeadRoutingInput) {
  return resolveLeadDestinationRule(tenantId, lead);
}
