"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import {
  fetchRoutingRules,
  simulateLeadRouting,
  type LeadRoutingInput,
  type TargetType,
  type RoutingRuleConditions,
} from "./routing-engine";

function assertAdminRole(role: string) {
  if (role !== "director" && role !== "manager") {
    throw new Error("Apenas Diretores ou Gestores podem modificar as regras de roteamento.");
  }
}

export const routingRuleSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Informe um nome para a regra").max(100),
  enabled: z.boolean().default(true),
  targetType: z.enum(["queue", "branch", "broker_group", "specific_broker"]).default("queue"),
  targetId: z.string().trim().min(1, "Selecione o destino"),
  fallbackQueueId: z.string().trim().optional().nullable(),
  planTypes: z.array(z.string()).optional().default([]),
  sources: z.array(z.string()).optional().default([]),
  cities: z.array(z.string()).optional().default([]),
  minLives: z.coerce.number().int().min(0).optional().nullable(),
  maxLives: z.coerce.number().int().min(0).optional().nullable(),
  qualificationStatuses: z.array(z.string()).optional().default([]),
});

export type RoutingRuleInput = z.infer<typeof routingRuleSchema>;

export async function getRoutingRulesAction() {
  const context = await getRequiredTenantContext();
  assertAdminRole(context.role);
  return fetchRoutingRules(context.tenantId);
}

export async function saveRoutingRuleAction(input: RoutingRuleInput) {
  const context = await getRequiredTenantContext();
  assertAdminRole(context.role);

  const parsed = routingRuleSchema.parse(input);
  const db = getDatabase();
  const now = new Date();

  const conditions: RoutingRuleConditions = {
    planTypes: parsed.planTypes.filter(Boolean),
    sources: parsed.sources.filter(Boolean),
    cities: parsed.cities.filter(Boolean),
    minLives: parsed.minLives ?? undefined,
    maxLives: parsed.maxLives ?? undefined,
    qualificationStatuses: parsed.qualificationStatuses.filter(Boolean),
  };

  let ruleId = parsed.id;

  if (ruleId) {
    await db
      .update(schema.leadRoutingRules)
      .set({
        name: parsed.name,
        enabled: parsed.enabled,
        targetType: parsed.targetType,
        targetId: parsed.targetId,
        fallbackQueueId: parsed.fallbackQueueId ?? null,
        conditions,
        updatedBy: context.userId,
        updatedAt: now,
      })
      .where(
        and(
          eq(schema.leadRoutingRules.id, ruleId),
          eq(schema.leadRoutingRules.tenantId, context.tenantId),
        ),
      );
  } else {
    ruleId = randomUUID();
    const existing = await fetchRoutingRules(context.tenantId);
    const priority = existing.length + 1;

    await db.insert(schema.leadRoutingRules).values({
      id: ruleId,
      tenantId: context.tenantId,
      name: parsed.name,
      priority,
      enabled: parsed.enabled,
      targetType: parsed.targetType,
      targetId: parsed.targetId,
      fallbackQueueId: parsed.fallbackQueueId ?? null,
      conditions,
      updatedBy: context.userId,
      createdAt: now,
      updatedAt: now,
    });
  }

  await db.insert(schema.auditLogs).values({
    id: randomUUID(),
    userId: context.userId,
    entidade: "lead_routing_rule",
    entidadeId: ruleId,
    acao: parsed.id ? "routing_rule.updated" : "routing_rule.created",
  });

  revalidatePath("/distribuicao");
  revalidatePath("/leads/distribuicao");
  return { success: true, ruleId };
}

export async function deleteRoutingRuleAction(ruleId: string) {
  const context = await getRequiredTenantContext();
  assertAdminRole(context.role);

  const db = getDatabase();
  await db
    .delete(schema.leadRoutingRules)
    .where(
      and(
        eq(schema.leadRoutingRules.id, ruleId),
        eq(schema.leadRoutingRules.tenantId, context.tenantId),
      ),
    );

  await db.insert(schema.auditLogs).values({
    id: randomUUID(),
    userId: context.userId,
    entidade: "lead_routing_rule",
    entidadeId: ruleId,
    acao: "routing_rule.deleted",
  });

  revalidatePath("/distribuicao");
  revalidatePath("/leads/distribuicao");
  return { success: true };
}

export async function reorderRoutingRulesAction(orderedIds: string[]) {
  const context = await getRequiredTenantContext();
  assertAdminRole(context.role);

  const db = getDatabase();
  const now = new Date();

  await Promise.all(
    orderedIds.map((id, index) =>
      db
        .update(schema.leadRoutingRules)
        .set({ priority: index + 1, updatedAt: now, updatedBy: context.userId })
        .where(
          and(
            eq(schema.leadRoutingRules.id, id),
            eq(schema.leadRoutingRules.tenantId, context.tenantId),
          ),
        ),
    ),
  );

  revalidatePath("/distribuicao");
  revalidatePath("/leads/distribuicao");
  return { success: true };
}

export async function simulateRoutingAction(leadInput: LeadRoutingInput) {
  const context = await getRequiredTenantContext();
  assertAdminRole(context.role);
  return simulateLeadRouting(context.tenantId, leadInput);
}
