"use server";

import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { brokerAiAccess } from "@/features/ai-gateway/broker-ai-pilot";
import { readAiConsent } from "@/features/ai-gateway/consent";
import { getCachedBrokerWorkspaceData } from "@/features/broker-workspace/chat/chat-rail-data";
import { runChatServerAction } from "@/features/broker-workspace/chat/chat-actions";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

import { runSasaCommand, sasaWorldOf, type SasaReply } from "./command-core";
import { classifySasaText } from "./intent-rules";
import { interpretSasaText } from "./interpret";
import { whenLabel } from "./parse-when";
import { firstNameOf } from "./resolve-entities";

const inputSchema = z.object({
  text: z.string().trim().min(1).max(500),
  clientCommandId: z.string().min(8).max(80).nullish(),
  pickedLeadId: z.string().min(1).max(80).nullish(),
});

const NOT_HANDLED: SasaReply = { handled: false, blocks: [] };
const AUDIT_ENTITY = "sasa_command";

/**
 * Pedido ao Sasá agêntica (fase 1). Tenant, usuário e papel vêm só da sessão; a IA nunca manda id.
 * Regras primeiro (grátis); a IA só interpreta quando as regras não casam e o corretor já consentiu.
 * `handled: false` devolve a vez para a resposta por IA de sempre (askAssistantAction).
 * Cada pedido vira uma linha em audit_logs ("sasa_command", id = clientCommandId), que também
 * garante que um reenvio (resposta perdida na internet ruim) não executa duas vezes.
 */
export async function sasaCommandAction(raw: { text: string; clientCommandId?: string | null; pickedLeadId?: string | null }): Promise<SasaReply> {
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) return NOT_HANDLED;
  const input = parsed.data;
  try {
    const context = await getRequiredTenantContext();
    if (context.role !== "broker") return NOT_HANDLED;
    // Piloto (D8): a mesma liberação da Sasá com IA (flag da empresa ou corretor do piloto).
    const access = await brokerAiAccess(context.userId);
    if (!access.enabled) return NOT_HANDLED;
    const db = getDatabase();

    if (input.clientCommandId) {
      const [previous] = await db.select({ metadata: schema.auditLogs.metadata }).from(schema.auditLogs)
        .where(and(eq(schema.auditLogs.entidade, AUDIT_ENTITY), eq(schema.auditLogs.entidadeId, input.clientCommandId), eq(schema.auditLogs.userId, context.userId)))
        .limit(1);
      const stored = previous?.metadata?.reply as SasaReply | undefined;
      if (stored && previous?.metadata?.tenantId === context.tenantId) return stored;
    }

    const now = new Date();
    const data = await getCachedBrokerWorkspaceData();
    const world = sasaWorldOf(data, now);

    let interpreted: Awaited<ReturnType<typeof interpretSasaText>> = null;
    let via: "rules" | "ai" = "rules";
    if (!classifySasaText(input.text)) {
      // LGPD: nada vai a um modelo sem o consentimento atual.
      const consent = await readAiConsent(context.tenantId, context.userId).catch(() => ({ granted: false }));
      if (!consent.granted) return NOT_HANDLED;
      interpreted = await interpretSasaText({
        tenantId: context.tenantId,
        userId: context.userId,
        text: input.text,
        leadFirstNames: [...new Set(world.leads.map((lead) => firstNameOf(lead.name)))],
        nowLabel: whenLabel(now, now),
      }).catch(() => null);
      if (!interpreted) return NOT_HANDLED;
      via = "ai";
    }

    const reply = await runSasaCommand({
      text: input.text,
      pickedLeadId: input.pickedLeadId ?? null,
      world,
      intent: interpreted?.intent,
      leadHint: interpreted?.leadHint,
      whenText: interpreted?.whenText,
      stamp: String(now.getTime()),
      run: (name, payload) => runChatServerAction(name, payload),
    });

    if (reply.handled) {
      await db.insert(schema.auditLogs).values({
        id: randomUUID(),
        userId: context.userId,
        entidade: AUDIT_ENTITY,
        entidadeId: input.clientCommandId ?? randomUUID(),
        acao: reply.executed ? (reply.executed.ok ? "sasa.executed" : "sasa.failed") : "sasa.answered",
        // Só o texto do pedido (D4: nunca áudio). A ação real já gravou a própria auditoria.
        metadata: { tenantId: context.tenantId, text: input.text, tool: reply.tool, via, pickedLeadId: input.pickedLeadId ?? null, executed: reply.executed ?? null, reply },
      }).catch((error) => console.error("[sasa] audit failed", error));
    }
    return reply;
  } catch (error) {
    console.error("[sasa] command failed", error);
    return NOT_HANDLED;
  }
}
