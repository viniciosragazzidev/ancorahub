"use server";

import { createHash, randomUUID } from "node:crypto";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import { getFeatureFlag } from "@/features/system-settings/queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { canDeleteUnlinkedConversation } from "./delete-unlinked-conversation-policy";

const phoneSchema = z.string().trim().min(8).max(32);

type DeleteConversationResult =
  | { success: true; deletedMessages: number }
  | { success: false; error: string };

function normalizedPhoneSql(
  column:
    | typeof schema.whatsappMessages.phone
    | typeof schema.leads.telefone
    | typeof schema.clients.telefone
    | typeof schema.brokerProfiles.phone,
  phone: string,
) {
  return sql`regexp_replace(${column}, '[^0-9]', '', 'g') = ${phone}`;
}

function deletionError(reason: "feature_disabled" | "forbidden_role" | "linked_contact") {
  if (reason === "feature_disabled") return "A exclusão de conversas está pausada pela plataforma.";
  if (reason === "forbidden_role") return "Apenas Diretor ou Gestor podem excluir conversas avulsas.";
  return "Esta conversa pertence a um lead, cliente ou membro da equipe e não pode ser excluída.";
}

export async function deleteUnlinkedConversationAction(rawPhone: string): Promise<DeleteConversationResult> {
  try {
    const parsed = phoneSchema.safeParse(rawPhone);
    if (!parsed.success) return { success: false, error: "Conversa inválida." };

    const phone = parsed.data.replace(/\D/g, "");
    if (phone.length < 8) return { success: false, error: "Conversa inválida." };

    const [context, featureValue] = await Promise.all([
      getRequiredTenantContext(),
      getFeatureFlag(FEATURE_FLAGS.UNLINKED_CONVERSATION_DELETION),
    ]);
    const db = getDatabase();

    const result = await db.transaction(async (tx) => {
      const [messageRows, leadRows, clientRows, teamRows] = await Promise.all([
        tx
          .select({ id: schema.whatsappMessages.id, leadId: schema.whatsappMessages.leadId, clientId: schema.whatsappMessages.clientId })
          .from(schema.whatsappMessages)
          .where(and(eq(schema.whatsappMessages.tenantId, context.tenantId), normalizedPhoneSql(schema.whatsappMessages.phone, phone))),
        tx
          .select({ id: schema.leads.id })
          .from(schema.leads)
          .where(and(eq(schema.leads.tenantId, context.tenantId), isNull(schema.leads.deletedAt), normalizedPhoneSql(schema.leads.telefone, phone)))
          .limit(1),
        tx
          .select({ id: schema.clients.id })
          .from(schema.clients)
          .where(and(eq(schema.clients.tenantId, context.tenantId), normalizedPhoneSql(schema.clients.telefone, phone)))
          .limit(1),
        tx
          .select({ id: schema.brokerProfiles.id })
          .from(schema.brokerProfiles)
          .where(and(eq(schema.brokerProfiles.tenantId, context.tenantId), normalizedPhoneSql(schema.brokerProfiles.phone, phone)))
          .limit(1),
      ]);

      if (!messageRows.length) return { success: false as const, error: "Conversa não encontrada." };

      const policy = canDeleteUnlinkedConversation({
        role: context.role,
        featureEnabled: featureValue === "true",
        hasLead: leadRows.length > 0 || messageRows.some((message) => Boolean(message.leadId)),
        hasClient: clientRows.length > 0 || messageRows.some((message) => Boolean(message.clientId)),
        hasTeamMember: teamRows.length > 0,
      });
      if (!policy.allowed) return { success: false as const, error: deletionError(policy.reason) };

      const messageIds = messageRows.map((message) => message.id);
      await tx
        .delete(schema.whatsappMessages)
        .where(and(eq(schema.whatsappMessages.tenantId, context.tenantId), inArray(schema.whatsappMessages.id, messageIds)));

      const conversationFingerprint = createHash("sha256")
        .update(`${context.tenantId}:${phone}`)
        .digest("hex")
        .slice(0, 24);
      await tx.insert(schema.auditLogs).values({
        id: randomUUID(),
        userId: context.userId,
        entidade: "unlinked_whatsapp_conversation",
        entidadeId: conversationFingerprint,
        acao: `conversation.deleted:${messageIds.length}`,
      });

      return { success: true as const, deletedMessages: messageIds.length };
    });

    return result;
  } catch {
    return { success: false, error: "Não foi possível excluir a conversa agora." };
  }
}
