import "server-only";

import { and, asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDatabase, schema } from "@/shared/db";
import type { TenantContext } from "@/shared/auth/types";
import { startBrokerLeadService } from "@/features/leads/start-lead-service";
import { loadBrokerGreetingSafe } from "@/features/leads/broker-greeting-server";
import { buildWhatsAppUrl, normalizeWhatsAppDestination } from "@/lib/whatsapp-url";
import { extensionTemperature, extensionTemperatureSchema } from "./payload";
import { maskPhone } from "./schemas";

/** Lead atribuído ao corretor que ainda não teve o atendimento iniciado (transferência, distribuição sem início). */
export const extensionLeadAguardandoInicioSchema = z.object({
  id: z.string().uuid(),
  primeiroNome: z.string(),
  phoneMasked: z.string(),
  temperatura: extensionTemperatureSchema,
  atribuidoEm: z.string().datetime().nullable(),
}).strict();

/** Unidade e dono, como nas ofertas: sem unidade, nada. */
function escopoDoCorretor(context: TenantContext) {
  return context.branchId
    ? and(eq(schema.leads.tenantId, context.tenantId), eq(schema.leads.corretorId, context.userId), eq(schema.leads.branchId, context.branchId))
    : undefined;
}

export async function listExtensionLeadsAwaitingStart(context: TenantContext) {
  const escopo = escopoDoCorretor(context);
  if (!escopo) return [];
  const rows = await getDatabase().select({
    id: schema.leads.id, nome: schema.leads.nome, telefone: schema.leads.telefone,
    qualificationStatus: schema.leads.qualificationStatus, assignedAt: schema.leads.assignedAt,
  }).from(schema.leads)
    .where(and(escopo, eq(schema.leads.status, "distributed"), isNull(schema.leads.deletedAt), isNull(schema.leads.archivedAt)))
    .orderBy(asc(schema.leads.assignedAt))
    .limit(50);
  return rows.map((row) => extensionLeadAguardandoInicioSchema.parse({
    id: row.id,
    primeiroNome: row.nome.trim().split(/\s+/)[0] || "Lead",
    phoneMasked: maskPhone(row.telefone),
    temperatura: extensionTemperature(row.qualificationStatus),
    atribuidoEm: row.assignedAt ? row.assignedAt.toISOString() : null,
  }));
}

/** Início pelo mesmo serviço do CRM. Devolve o contato para a extensão abrir a conversa nativa, sem enviar nada. */
export async function startExtensionLead(context: TenantContext, leadId: string) {
  const escopo = escopoDoCorretor(context);
  const [visivel] = escopo
    ? await getDatabase().select({ id: schema.leads.id }).from(schema.leads).where(and(escopo, eq(schema.leads.id, leadId))).limit(1)
    : [];
  if (!visivel) return { status: 404, body: { success: false, error: "NOT_FOUND", message: "Este lead não está mais disponível para você." } };

  const started = await startBrokerLeadService(context, leadId);
  if (!started.ok) {
    return { status: 409, body: { success: false, error: "UNAVAILABLE", message: started.error } };
  }
  const greeting = await loadBrokerGreetingSafe({ tenantId: context.tenantId, leadId, brokerUserId: context.userId, leadName: started.lead.nome });
  return { status: 200, body: {
    success: true, leadId, action: "service_started",
    phone: normalizeWhatsAppDestination(started.lead.telefone), greeting,
    whatsappUrl: buildWhatsAppUrl(started.lead.telefone, greeting),
  } };
}
