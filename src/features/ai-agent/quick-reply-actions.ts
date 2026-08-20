"use server";

import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { quickReplyTemplateSchema } from "./quick-reply";

const inputSchema = quickReplyTemplateSchema.extend({ ruleKey: z.string().trim().min(1).max(80) });

export async function updateQuickReplyTemplateAction(rawInput: unknown) {
  const input = inputSchema.parse(rawInput);
  const context = await getRequiredTenantContext();
  if (context.role !== "director") return { success: false as const, error: "Apenas o Diretor pode editar templates do atendimento." };
  const db = getDatabase();
  const [existing] = await db.select({ id: schema.aiQuickReplyTemplates.id }).from(schema.aiQuickReplyTemplates).where(and(eq(schema.aiQuickReplyTemplates.tenantId, context.tenantId), eq(schema.aiQuickReplyTemplates.ruleKey, input.ruleKey))).limit(1);
  if (existing) {
    await db.update(schema.aiQuickReplyTemplates).set({ templateKey: input.templateKey, body: input.body, active: input.active, updatedBy: context.userId, updatedAt: new Date() }).where(and(eq(schema.aiQuickReplyTemplates.id, existing.id), eq(schema.aiQuickReplyTemplates.tenantId, context.tenantId)));
  } else {
    await db.insert(schema.aiQuickReplyTemplates).values({ id: randomUUID(), tenantId: context.tenantId, ruleKey: input.ruleKey, templateKey: input.templateKey, body: input.body, active: input.active, updatedBy: context.userId });
  }
  await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "ai_quick_reply_template", entidadeId: existing?.id ?? input.ruleKey, acao: "updated" });
  return { success: true as const };
}
