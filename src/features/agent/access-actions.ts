"use server";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { setSystemSetting } from "@/features/system-settings/queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

import { listAgentOffUsers } from "./access";
import { agentOffSettingKey, withAgentAccess } from "./access-rules";

const inputSchema = z.object({ userId: z.string().min(1).max(80), enabled: z.boolean() });

/** Liga ou desliga o Agente IA de uma pessoa da empresa (ficha em Equipe). Só o diretor muda. */
export async function setMemberAgentAccessAction(raw: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const input = inputSchema.parse(raw);
    const context = await getRequiredTenantContext();
    if (context.role !== "director") return { ok: false, error: "Só o diretor liga ou desliga o Agente IA de alguém." };
    const db = getDatabase();
    const [member] = await db.select({ id: schema.tenantMemberships.id })
      .from(schema.tenantMemberships)
      .where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.userId, input.userId)))
      .limit(1);
    if (!member) return { ok: false, error: "Essa pessoa não é da sua empresa." };
    const next = withAgentAccess(await listAgentOffUsers(context.tenantId), input.userId, input.enabled);
    await setSystemSetting(agentOffSettingKey(context.tenantId), JSON.stringify(next));
    await db.insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: context.userId,
      entidade: "tenant_membership",
      entidadeId: member.id,
      acao: input.enabled ? "agente_ia_ligado" : "agente_ia_desligado",
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Não deu para salvar o Agente IA agora." };
  }
}
