import "server-only";

import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import type { TenantContext } from "@/shared/auth/types";
import { isIncomingDirection } from "@/features/conversations/message-window";
import { extensionQualificationThreadSchema, QUALIFICATION_THREAD_LIMIT, type ExtensionQualificationThread } from "./qualification-thread-schema";

export { extensionQualificationThreadSchema, QUALIFICATION_THREAD_LIMIT, type ExtensionQualificationThread };

/** Mesma regra de lead visível da extensão: dono e unidade. Sem unidade, nada. */
function escopoDoCorretor(context: TenantContext) {
  return context.branchId
    ? and(eq(schema.leads.tenantId, context.tenantId), eq(schema.leads.corretorId, context.userId), eq(schema.leads.branchId, context.branchId))
    : undefined;
}

export async function loadExtensionQualificationThread(context: TenantContext, leadId: string): Promise<ExtensionQualificationThread | null> {
  const escopo = escopoDoCorretor(context);
  if (!escopo) return null;
  const db = getDatabase();
  const [visivel] = await db.select({ id: schema.leads.id }).from(schema.leads)
    .where(and(escopo, eq(schema.leads.id, leadId), isNull(schema.leads.deletedAt), isNull(schema.leads.archivedAt))).limit(1);
  if (!visivel) return null;

  // Conversa de qualificação = mensagens do lead no número oficial (canal de comunicação), sem anexo.
  const condicao = and(
    eq(schema.whatsappMessages.tenantId, context.tenantId),
    eq(schema.whatsappMessages.leadId, leadId),
    isNotNull(schema.whatsappMessages.communicationChannelId),
    isNull(schema.whatsappMessages.mediaKind),
  );
  const [contagem] = await db.select({ total: sql<number>`count(*)::int` }).from(schema.whatsappMessages).where(condicao);
  const linhas = await db.select({
    direction: schema.whatsappMessages.direction, body: schema.whatsappMessages.body, sentAt: schema.whatsappMessages.sentAt,
  }).from(schema.whatsappMessages)
    .where(condicao)
    .orderBy(desc(schema.whatsappMessages.sentAt))
    .limit(QUALIFICATION_THREAD_LIMIT);

  return extensionQualificationThreadSchema.parse({
    leadId,
    total: Number(contagem?.total ?? 0),
    // Do mais antigo para o mais novo, como uma conversa.
    mensagens: linhas.reverse().map((linha) => ({
      de: isIncomingDirection(linha.direction) ? "cliente" : "qualificacao",
      texto: linha.body,
      horario: linha.sentAt.toISOString(),
    })),
  });
}
