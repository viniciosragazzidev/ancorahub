"use server";

import { and, eq } from "drizzle-orm";

import { publishNotification } from "@/features/notifications/send-push-helper";
import { TIPO_AVISO_RECONEXAO } from "@/features/whatsapp-autorreparo/aviso";
import { TITULO_AVISO_RECONEXAO } from "@/features/whatsapp-autorreparo/texto";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

import { escopoCorretores } from "./queries";
import { chavePedidoReconexao } from "./situacao";

const MENSAGEM_PEDIDO = "A direção pediu para você reconectar seu WhatsApp. Abra Configurações e escaneie o QR para suas conversas voltarem a entrar no CRM.";

/**
 * "Pedir para reconectar": aviso in-app (com push) ao corretor, pelo mesmo tipo do aviso de véspera do vigia.
 * Não existe aviso de reconexão por WhatsApp no catálogo de avisos da equipe, então fica só no app.
 * Um pedido por corretor por hora (chave idempotente); repetir dentro da hora não manda de novo.
 */
export async function pedirReconexaoAction(corretorId: string): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const context = await getRequiredTenantContext();
    const escopo = escopoCorretores(context);
    if (escopo === null) return { success: false, error: "Só a direção e a gestão podem pedir a reconexão." };
    const [corretor] = await getDatabase()
      .select({ id: schema.tenantMemberships.userId })
      .from(schema.tenantMemberships)
      .where(and(
        eq(schema.tenantMemberships.tenantId, context.tenantId),
        eq(schema.tenantMemberships.userId, corretorId),
        eq(schema.tenantMemberships.role, "broker"),
        eq(schema.tenantMemberships.status, "active"),
        escopo,
      ))
      .limit(1);
    if (!corretor) return { success: false, error: "Corretor não encontrado na sua equipe." };

    const enviado = await publishNotification({
      capability: "relationship_message",
      tenantId: context.tenantId,
      recipientUserId: corretor.id,
      type: TIPO_AVISO_RECONEXAO,
      title: TITULO_AVISO_RECONEXAO,
      message: MENSAGEM_PEDIDO,
      url: "/settings?tab=whatsapp",
      tag: `whatsapp-reconexao-${corretor.id}`,
      idempotencyKey: chavePedidoReconexao(corretor.id, new Date()),
    });
    if (!enviado) return { success: false, error: "Os avisos da direção estão desligados em Notificações." };
    return { success: true };
  } catch {
    return { success: false, error: "Não deu para mandar o aviso agora." };
  }
}
